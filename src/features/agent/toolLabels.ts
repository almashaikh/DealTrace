/** Friendly names for the tools listed under an answer. */
const LABELS: Record<string, string> = {
  get_deal_versions: 'Deal versions',
  diff_versions: 'Version diff',
  run_detectors: 'Detectors',
  check_benefit: 'Benefit check',
  lookup_rule: 'Rule lookup',
  pricing_dispersion: 'Pricing data',
  get_timeline: 'Timeline',
  list_findings: 'Findings',
}

export function toolLabel(name: string): string {
  return LABELS[name] ?? name.replace(/_/g, ' ')
}

export function formatLatency(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`
}
