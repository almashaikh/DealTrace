import { useCallback, useEffect, useReducer, useRef } from 'react'

import { followUpAnswer, type AnswerContext } from '@/features/agent/answers'
import { answerFromSummary, streamAnswer, type ScriptedAnswer, type StreamEvent } from '@/features/agent/stream'
import type { AgentSummary, Deal } from '@/types'

export interface Step {
  name: string
  label: string
  done: boolean
}

export interface AssistantMessage {
  id: string
  role: 'assistant'
  kind: 'summary' | 'followup'
  /** What gets played. Kept so Regenerate can play it again. */
  answer: ScriptedAnswer
  steps: Step[]
  text: string
  status: 'streaming' | 'done'
  latency_ms?: number
  tools_used: string[]
  feedback: 'up' | 'down' | null
}

export interface UserMessage {
  id: string
  role: 'user'
  text: string
}

export type Message = UserMessage | AssistantMessage

type Action =
  | { type: 'clear' }
  | { type: 'add'; message: Message }
  | { type: 'reset'; id: string }
  | { type: 'event'; id: string; event: StreamEvent }
  | { type: 'feedback'; id: string; value: 'up' | 'down' }

function newAssistant(id: string, kind: AssistantMessage['kind'], answer: ScriptedAnswer): AssistantMessage {
  return { id, role: 'assistant', kind, answer, steps: [], text: '', status: 'streaming', tools_used: [], feedback: null }
}

function applyEvent(m: AssistantMessage, event: StreamEvent): AssistantMessage {
  const finished = m.steps.map((s) => ({ ...s, done: true }))
  switch (event.type) {
    case 'tool':
      return { ...m, steps: [...finished, { name: event.name, label: event.label, done: false }] }
    case 'token':
      return { ...m, steps: finished, text: m.text + event.text }
    case 'done':
      return { ...m, steps: finished, status: 'done', latency_ms: event.latency_ms, tools_used: event.tools_used }
  }
}

function reducer(state: Message[], action: Action): Message[] {
  switch (action.type) {
    case 'clear':
      return []
    case 'add':
      return [...state, action.message]
    case 'reset':
      return state.map((m) => (m.id === action.id && m.role === 'assistant' ? newAssistant(m.id, m.kind, m.answer) : m))
    case 'event':
      return state.map((m) => (m.id === action.id && m.role === 'assistant' ? applyEvent(m, action.event) : m))
    case 'feedback':
      return state.map((m) => (m.id === action.id && m.role === 'assistant' ? { ...m, feedback: action.value } : m))
  }
}

/** What the assistant says about a deal with no open findings. */
function cleanDealAnswer(deal: Deal): ScriptedAnswer {
  return {
    text: `**Summary** – ${deal.id} has no open findings. Its versions and events were checked and nothing in the record needs a decision before funding. [v${deal.current_version}]`,
    tools: [
      { name: 'get_timeline', label: 'Reading timeline' },
      { name: 'list_findings', label: 'Checking findings' },
    ],
    tools_used: ['get_deal_versions', 'run_detectors'],
  }
}

/**
 * The scripted conversation: the case summary plays on open, follow-up questions get canned answers,
 * and every answer streams the same way. Nothing here calls a model.
 */
export function useAssistant(summary: AgentSummary | null, ctx: AnswerContext) {
  const [messages, dispatch] = useReducer(reducer, [])
  const controllers = useRef(new Map<string, AbortController>())
  const counter = useRef(0)
  // The latest context, read when a stream starts, so a refetch while the sheet is open does not replay the answer.
  const latest = useRef({ summary, ctx })
  useEffect(() => {
    latest.current = { summary, ctx }
  })

  const run = useCallback(async (id: string, answer: ScriptedAnswer) => {
    controllers.current.get(id)?.abort()
    const ctrl = new AbortController()
    controllers.current.set(id, ctrl)
    for await (const event of streamAnswer(answer, { signal: ctrl.signal })) dispatch({ type: 'event', id, event })
  }, [])

  const dealId = ctx.deal.id
  useEffect(() => {
    const { summary: s, ctx: c } = latest.current
    const answer = s ? answerFromSummary(s) : cleanDealAnswer(c.deal)
    dispatch({ type: 'clear' })
    dispatch({ type: 'add', message: newAssistant('summary', 'summary', answer) })
    void run('summary', answer)
    const live = controllers.current
    return () => {
      live.forEach((c) => c.abort())
      live.clear()
    }
  }, [dealId, run])

  const ask = useCallback(
    (question: string) => {
      const text = question.trim()
      if (!text) return
      const id = `q${++counter.current}`
      const answer = followUpAnswer(text, latest.current.ctx)
      dispatch({ type: 'add', message: { id: `${id}-user`, role: 'user', text } })
      dispatch({ type: 'add', message: newAssistant(id, 'followup', answer) })
      void run(id, answer)
    },
    [run],
  )

  const regenerate = useCallback(
    (id: string) => {
      const m = messages.find((x) => x.id === id)
      if (!m || m.role !== 'assistant') return
      dispatch({ type: 'reset', id })
      void run(id, m.answer)
    },
    [messages, run],
  )

  const giveFeedback = useCallback((id: string, value: 'up' | 'down') => dispatch({ type: 'feedback', id, value }), [])

  const busy = messages.some((m) => m.role === 'assistant' && m.status === 'streaming')
  return { messages, busy, ask, regenerate, giveFeedback }
}
