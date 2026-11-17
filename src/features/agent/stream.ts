import type { AgentSummary } from '@/types'

/**
 * The review assistant is scripted. It replays pre-written answers with the timing of a live response:
 * a few tool steps first, then the text in small chunks. Nothing here calls a model.
 */

export type StreamEvent =
  | { type: 'tool'; name: string; label: string }
  | { type: 'token'; text: string }
  | { type: 'done'; latency_ms: number; tools_used: string[] }

export interface ScriptedTool {
  name: string
  label: string
}

export interface ScriptedAnswer {
  /** Markdown with citations such as [F-2291], [event E-1043], [rule CA-CARS-ADDON-01] and [v2]. */
  text: string
  tools: ScriptedTool[]
  tools_used: string[]
}

export interface StreamTimings {
  /** Pause before each tool step, in ms. */
  toolDelayMs: number
  /** Pause between text chunks, in ms. */
  tokenDelayMs: number
  /** Roughly how many characters go into one chunk. */
  chunkSize: number
}

export const DEFAULT_TIMINGS: StreamTimings = { toolDelayMs: 400, tokenDelayMs: 30, chunkSize: 8 }

export interface StreamOptions {
  timings?: Partial<StreamTimings>
  /** Stops the stream: the generator ends without a done event. */
  signal?: AbortSignal
}

/** Splits text into word-aligned chunks of about `size` characters. Joining the chunks gives the text back. */
export function chunkText(text: string, size: number): string[] {
  const words = text.match(/\s*\S+\s*/g) ?? (text ? [text] : [])
  const chunks: string[] = []
  let current = ''
  for (const w of words) {
    current += w
    if (current.length >= size) {
      chunks.push(current)
      current = ''
    }
  }
  if (current) chunks.push(current)
  return chunks
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

/** Plays a scripted answer: tool events about 400 ms apart, then text chunks about every 30 ms, then done. */
export async function* streamAnswer(answer: ScriptedAnswer, options: StreamOptions = {}): AsyncGenerator<StreamEvent> {
  const t = { ...DEFAULT_TIMINGS, ...options.timings }
  const { signal } = options
  const started = performance.now()

  for (const tool of answer.tools) {
    await wait(t.toolDelayMs, signal)
    if (signal?.aborted) return
    yield { type: 'tool', name: tool.name, label: tool.label }
  }
  // The last tool takes its time to finish before the answer starts.
  await wait(answer.tools.length > 0 ? t.toolDelayMs : 0, signal)

  for (const chunk of chunkText(answer.text, t.chunkSize)) {
    if (signal?.aborted) return
    yield { type: 'token', text: chunk }
    await wait(t.tokenDelayMs, signal)
  }
  if (signal?.aborted) return
  yield { type: 'done', latency_ms: Math.round(performance.now() - started), tools_used: answer.tools_used }
}

/** The case summary for a deal as markdown: a summary line, key points and suggested next steps. */
export function summaryMarkdown(summary: Pick<AgentSummary, 'summary' | 'key_points' | 'suggested_actions'>): string {
  return [
    `**Summary** – ${summary.summary}`,
    '',
    '**Key points**',
    ...summary.key_points.map((k) => `- ${k}`),
    '',
    '**Suggested next steps**',
    ...summary.suggested_actions.map((a) => `- ${a}`),
  ].join('\n')
}

/** Rule id cited in a text, for the "Looking up …" tool step. */
function citedRule(text: string): string | undefined {
  return /\[rule ([A-Z0-9-]+)\]/.exec(text)?.[1]
}

/** Turns a stored summary into a scripted answer: two or three tool steps, then the text. */
export function answerFromSummary(summary: AgentSummary): ScriptedAnswer {
  const text = summaryMarkdown(summary)
  const rule = citedRule(text)
  const tools: ScriptedTool[] = [
    { name: 'get_timeline', label: 'Reading timeline' },
    { name: 'list_findings', label: 'Checking findings' },
  ]
  if (rule) tools.push({ name: 'lookup_rule', label: `Looking up ${rule}` })
  return { text, tools, tools_used: summary.tools_used }
}

/** Convenience: stream the stored summary of a deal. */
export function streamSummary(summary: AgentSummary, options?: StreamOptions): AsyncGenerator<StreamEvent> {
  return streamAnswer(answerFromSummary(summary), options)
}
