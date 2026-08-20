export function isInternalDiagnosticsEnabled(search: string): boolean {
  return new URLSearchParams(search).get('diagnostics') === '1'
}

export function formatDiagnosticBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GiB`
}

export function formatDiagnosticLatency(seconds: number | null): string {
  return seconds === null ? '—' : `${(seconds * 1000).toFixed(1)} ms`
}

export function formatDiagnosticRatio(ratio: number | null): string {
  return ratio === null ? '—' : `${(ratio * 100).toFixed(1)}%`
}
