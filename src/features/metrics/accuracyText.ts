import type { Metrics } from '@/types'

/** Scores are shown to three decimals: 0.912. */
export function formatScore(n: number): string {
  return n.toFixed(3)
}

export interface HistoryPoint {
  /** "v3" */
  label: string
  /** "v3 · 480 deals" */
  axis: string
  f1: number
  dataset: string
}

/** The F1 history as chart points, in order, with the version and deal count read from the test set name. */
export function historyPoints(history: Metrics['history']): HistoryPoint[] {
  return history.map((h, i) => {
    const m = /v(\d+) \((\d[\d,]*) deals\)/.exec(h.dataset)
    return { label: m ? `v${m[1]}` : `Set ${i + 1}`, axis: m ? `v${m[1]} · ${m[2]} deals` : `Set ${i + 1}`, f1: h.f1, dataset: h.dataset }
  })
}

/** Share of all cases that fall in one cell of the confusion matrix, as a percent with one decimal. */
export function cellShare(count: number, matrix: Metrics['confusion_matrix']): string {
  const total = matrix.tp + matrix.fp + matrix.fn + matrix.tn
  return total === 0 ? '0%' : `${((count / total) * 100).toFixed(1)}%`
}
