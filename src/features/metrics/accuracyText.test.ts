import { describe, expect, it } from 'vitest'

import { cellShare, formatScore, historyPoints } from '@/features/metrics/accuracyText'
import { seed } from '@/mocks/db'

describe('accuracy text', () => {
  const m = seed.metrics

  it('shows scores to three decimals', () => {
    expect([m.overall.precision, m.overall.recall, m.overall.f1].map(formatScore)).toEqual(['0.912', '0.874', '0.893'])
  })

  it('reads the test set versions and sizes for the chart', () => {
    expect(historyPoints(m.history).map((p) => [p.label, p.axis, p.f1])).toEqual([
      ['v1', 'v1 · 240 deals', 0.811],
      ['v2', 'v2 · 360 deals', 0.862],
      ['v3', 'v3 · 480 deals', 0.893],
    ])
  })

  it('has a confusion matrix that agrees with the scores', () => {
    const { tp, fp, fn, tn } = m.confusion_matrix
    expect([tp, fp, fn, tn]).toEqual([146, 14, 21, 299])
    expect(tp + fp + fn + tn).toBe(480)
    expect(formatScore(tp / (tp + fp))).toBe('0.912')
    expect(formatScore(tp / (tp + fn))).toBe('0.874')
    expect(cellShare(tn, m.confusion_matrix)).toBe('62.3%')
  })

  it('has per-detector rows that average to the overall scores', () => {
    const avg = (k: 'precision' | 'recall' | 'f1') => m.per_detector.reduce((s, r) => s + r[k], 0) / m.per_detector.length
    expect(formatScore(avg('precision'))).toBe('0.912')
    expect(formatScore(avg('recall'))).toBe('0.874')
    expect(formatScore(avg('f1'))).toBe('0.893')
  })
})
