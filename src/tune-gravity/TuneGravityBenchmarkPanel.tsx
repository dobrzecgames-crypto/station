import type { TuneGravityBenchmarkDocument } from '../audio/tuneGravity/index.ts'

interface TuneGravityBenchmarkPanelProps {
  report: TuneGravityBenchmarkDocument | null
  running: boolean
  disabled: boolean
  onRun: () => void
  onExport: () => void
  onCopy: () => void
}

export function TuneGravityBenchmarkPanel({ report, running, disabled, onRun, onExport, onCopy }: TuneGravityBenchmarkPanelProps) {
  return <section className="tune-benchmark-panel" aria-labelledby="tune-benchmark-title">
    <header><div><p className="eyebrow">QUALITY WORKFLOW</p><h3 id="tune-benchmark-title">MOBILE BENCHMARK</h3></div>{report && <span>{report.browser.label}</span>}</header>
    <p>Runs offline YIN, MPM, TD-PSOLA and granular measurements. It does not create or test a realtime AudioWorklet.</p>
    <button className="transport-button" type="button" disabled={disabled || running} onClick={onRun}>{running ? 'BENCHMARK RUNNING…' : 'RUN QUALITY BENCHMARK'}</button>
    {report && <>
      <dl className="tune-benchmark-results">
        <BenchmarkValue label="YIN" value={formatMilliseconds(report.timings.yinMs)} />
        <BenchmarkValue label="MPM" value={formatMilliseconds(report.timings.mpmMs)} />
        <BenchmarkValue label="TD-PSOLA" value={formatMilliseconds(report.timings.tdPsolaMs)} />
        <BenchmarkValue label="GRANULAR" value={formatMilliseconds(report.timings.granularMs)} />
        <BenchmarkValue label="TOTAL" value={formatMilliseconds(report.timings.totalMs)} />
        <BenchmarkValue label="RATIO" value={report.processingToAudioRatio === null ? '—' : `${report.processingToAudioRatio.toFixed(2)}×`} />
        <BenchmarkValue label="EST. MEMORY" value={`${(report.memory.estimatedWorkingSetBytes / 1024 / 1024).toFixed(1)} MB`} />
        <BenchmarkValue label="BACKGROUND" value={report.lifecycle.backgroundedDuringRun ? 'YES' : 'NO'} />
      </dl>
      <p className="tune-benchmark-agent">{report.browser.userAgent}</p>
      {report.lifecycle.error && <p className="tune-benchmark-error">{report.lifecycle.error}</p>}
      <div className="tune-benchmark-actions"><button className="clear-button" type="button" onClick={onCopy}>COPY JSON</button><button className="clear-button" type="button" onClick={onExport}>EXPORT BENCHMARK JSON</button></div>
    </>}
  </section>
}

function BenchmarkValue({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

function formatMilliseconds(value: number | null): string {
  return value === null ? '—' : value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value.toFixed(0)} ms`
}
