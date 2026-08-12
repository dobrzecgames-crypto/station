import { useEffect, useMemo, useRef, useState } from 'react'
import type { PadState } from '../pads/types'
import { useDragSlider } from '../shell/useDragSlider'
import { applyPolyFactoryPatch, polyFactoryPatches } from './polyPresets'
import { clampModulationAmount } from './polyOperations'
import { polyFilterModes, polyLfoDivisions, polyLfoShapes, polyModDestinations, polyUnisonCounts } from './polyTypes'
import type { PolyEnvelopeState, PolyFilterMode, PolyLfoState, PolyModDestination, PolyModSource, PolyOscillatorState, PolyPatch } from './polyTypes'
import { generatePolyWavetable, interpolateWavetablePosition, polyWavetableBank } from './polyWavetables'
import './PolyWorkspace.css'

interface Props {
  pad: PadState
  patch: PolyPatch
  usageCount: number
  audioReady: boolean
  projectBusy: boolean
  projectKeyLabel: string
  onPatchChange: (patch: PolyPatch) => void
  readWaveform: (target: Float32Array<ArrayBuffer>) => boolean
  onTrigger: () => void
  onRelease: () => void
  onMapToProjectScale: () => void
  onClear: () => void
  onBack: () => void
}

type Page = 'osc' | 'filter' | 'env' | 'mod'
type OscillatorKey = 'oscillator1' | 'oscillator2'
type OscillatorDetail = 'tune' | 'spread' | 'output' | null
type EnvelopeKey = 'ampEnvelope' | 'filterEnvelope' | 'modEnvelope'

const pageLabels: Readonly<Record<Page, string>> = { osc: 'OSC', filter: 'FILTER', env: 'ENV', mod: 'MOD' }
const envelopeLabels: Readonly<Record<EnvelopeKey, string>> = { ampEnvelope: 'AMP', filterEnvelope: 'FILTER', modEnvelope: 'MOD' }
const primaryModSources: readonly PolyModSource[] = ['lfo1', 'lfo2', 'modEnv']
const performanceModSources: readonly PolyModSource[] = ['velocity', 'keytrack']

export function PolyWorkspace(props: Props) {
  const { patch } = props
  const [page, setPage] = useState<Page>('osc')
  const [oscillatorKey, setOscillatorKey] = useState<OscillatorKey>('oscillator1')
  const [oscillatorDetail, setOscillatorDetail] = useState<OscillatorDetail>(null)
  const [envelopeKey, setEnvelopeKey] = useState<EnvelopeKey>('ampEnvelope')
  const [modSource, setModSource] = useState<PolyModSource>('lfo1')
  const [routePickerOpen, setRoutePickerOpen] = useState(false)
  const releaseRef = useRef(props.onRelease)
  releaseRef.current = props.onRelease
  useEffect(() => () => releaseRef.current(), [])

  const change = (changes: Partial<PolyPatch>) => props.onPatchChange({ ...patch, ...changes })
  const oscillator = patch[oscillatorKey]
  const envelope = patch[envelopeKey]
  const activeRoutes = patch.modulation.filter((route) => route.source === modSource && Math.abs(route.amount) >= .005)
  const availableDestinations = polyModDestinations.filter((destination) => !activeRoutes.some((route) => route.destination === destination))

  const updateRoute = (destination: PolyModDestination, nextAmount: number) => {
    const without = patch.modulation.filter((route) => !(route.source === modSource && route.destination === destination))
    const modulation = Math.abs(nextAmount) < .005
      ? without
      : [...without, { source: modSource, destination, amount: clampModulationAmount(nextAmount) }]
    change({ modulation })
  }

  return <section className="poly-workspace" aria-label={`POLY editor for ${props.pad.label}`}>
    <div className="poly-back-row"><button className="mixer-toggle" type="button" onClick={props.onBack}>← BACK TO SYNTHS</button></div>
    <header className="poly-heading">
      <div><p className="eyebrow">POLY / {props.pad.label}</p><h2>{patch.name}</h2><p>{props.usageCount} PADS SHARE PATCH / 8 VOICES</p></div>
      <button className="poly-audition" type="button" disabled={!props.audioReady} aria-label="Hold to play POLY" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); props.onTrigger() }} onPointerUp={props.onRelease} onPointerCancel={props.onRelease} onLostPointerCapture={props.onRelease} />
    </header>

    <label className="poly-preset"><span>STARTING PATCH</span><select value={polyFactoryPatches.find((item) => item.name === patch.name)?.id ?? ''} onChange={(event) => props.onPatchChange(applyPolyFactoryPatch(patch, event.target.value))}><option value="" disabled>CUSTOM</option>{polyFactoryPatches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>

    <SelectorRow label="POLY section" className="poly-pages" options={(['osc', 'filter', 'env', 'mod'] as const)} selected={page} labelFor={(item) => pageLabels[item]} onSelect={(item) => { setPage(item); setRoutePickerOpen(false) }} />

    <div className="poly-editor-panel">
      {page === 'osc' && <>
        <SelectorRow label="Oscillator" options={(['oscillator1', 'oscillator2'] as const)} selected={oscillatorKey} labelFor={(item) => item === 'oscillator1' ? 'OSC 1' : 'OSC 2'} onSelect={(item) => { setOscillatorKey(item); setOscillatorDetail(null) }} />
        <PolyDisplay eyebrow={`${oscillatorKey === 'oscillator1' ? 'OSC 1' : 'OSC 2'} / ${wavetableLabel(oscillator.tableId)}`} value={`${Math.round(oscillator.position * 100)}% POSITION`}>
          <WavetableVisual tableId={oscillator.tableId} position={oscillator.position} readWaveform={props.readWaveform} />
        </PolyDisplay>
        <div className="poly-osc-main-controls">
          <label className="poly-table"><span>TABLE</span><select value={oscillator.tableId} onChange={(event) => change({ [oscillatorKey]: { ...oscillator, tableId: event.target.value } })}>{polyWavetableBank.map((item) => <option value={item.id} key={item.id}>{item.family} / {item.name}</option>)}</select></label>
          <Control label="POSITION" value={oscillator.position} onChange={(position) => change({ [oscillatorKey]: { ...oscillator, position } })} format={percent} />
          <Control label="LEVEL" value={oscillator.level} onChange={(level) => change({ [oscillatorKey]: { ...oscillator, level } })} format={percent} />
          <label className="poly-select-control"><span>UNISON</span><select value={oscillator.unison} onChange={(event) => change({ [oscillatorKey]: { ...oscillator, unison: Number(event.target.value) as PolyOscillatorState['unison'] } })}>{polyUnisonCounts.map((count) => <option value={count} key={count}>{count}</option>)}</select></label>
        </div>
        <div className="poly-detail-keys" role="group" aria-label="Oscillator details">
          <SelectorButton label="TUNE" selected={oscillatorDetail === 'tune'} onClick={() => setOscillatorDetail('tune')} />
          <SelectorButton label="SPREAD" selected={oscillatorDetail === 'spread'} onClick={() => setOscillatorDetail('spread')} />
        </div>
        {oscillatorDetail === 'tune' && <div className="poly-secondary-panel" aria-label="Oscillator tuning"><Control label="OCTAVE" value={oscillator.octave} min={-2} max={2} step={1} onChange={(octave) => change({ [oscillatorKey]: { ...oscillator, octave } })} format={signed} /><Control label="SEMITONE" value={oscillator.semitone} min={-12} max={12} step={1} onChange={(semitone) => change({ [oscillatorKey]: { ...oscillator, semitone } })} format={signed} /><Control label="FINE" value={oscillator.fineCents} min={-100} max={100} step={1} onChange={(fineCents) => change({ [oscillatorKey]: { ...oscillator, fineCents } })} format={(value) => `${signed(value)} ct`} /></div>}
        {oscillatorDetail === 'spread' && <div className="poly-secondary-panel" aria-label="Oscillator spread"><Control label="DETUNE" value={oscillator.detuneCents} min={0} max={50} step={1} onChange={(detuneCents) => change({ [oscillatorKey]: { ...oscillator, detuneCents } })} format={(value) => `${value.toFixed(0)} ct`} /><Control label="WIDTH" value={oscillator.width} onChange={(width) => change({ [oscillatorKey]: { ...oscillator, width } })} format={percent} /></div>}
        <div className="poly-common-area">
          <p>OSC 1 <span>MIX / CROSS-MOD</span> OSC 2</p>
          <div className="poly-common-controls"><Control label="OSC MIX" value={patch.oscillatorMix} onChange={(oscillatorMix) => change({ oscillatorMix })} format={percent} /><Control label="OSC 2 → OSC 1 FM" value={patch.fmAmount} onChange={(fmAmount) => change({ fmAmount })} format={percent} /></div>
          <SelectorButton label="OUTPUT" selected={oscillatorDetail === 'output'} onClick={() => setOscillatorDetail('output')} />
          {oscillatorDetail === 'output' && <div className="poly-secondary-panel"><Control label="MASTER LEVEL" value={patch.level} onChange={(level) => change({ level })} format={percent} /><Control label="PAN" value={patch.pan} min={-1} max={1} onChange={(pan) => change({ pan })} format={signedPercent} /></div>}
        </div>
      </>}

      {page === 'filter' && <>
        <SelectorRow label="Filter mode" options={polyFilterModes} selected={patch.filter.mode} labelFor={(mode) => mode} onSelect={(mode) => change({ filter: { ...patch.filter, mode } })} />
        <PolyDisplay eyebrow={`${patch.filter.mode} FILTER`} value={frequency(patch.filter.cutoffHz)}><FilterVisual mode={patch.filter.mode} cutoffHz={patch.filter.cutoffHz} resonance={patch.filter.resonance} /></PolyDisplay>
        <div className="poly-control-grid poly-filter-controls"><Control label="CUTOFF" value={patch.filter.cutoffHz} min={20} max={20000} step={1} onChange={(cutoffHz) => change({ filter: { ...patch.filter, cutoffHz } })} format={frequency} /><Control label="RESONANCE" value={patch.filter.resonance} min={.5} max={20} step={.1} onChange={(resonance) => change({ filter: { ...patch.filter, resonance } })} format={(value) => value.toFixed(1)} /><Control label="DRIVE" value={patch.filter.drive} onChange={(drive) => change({ filter: { ...patch.filter, drive } })} format={percent} /><Control label="ENV AMOUNT" value={patch.filter.envelopeAmountSemitones} min={-60} max={60} step={1} onChange={(envelopeAmountSemitones) => change({ filter: { ...patch.filter, envelopeAmountSemitones } })} format={(value) => `${value > 0 ? '+' : ''}${value.toFixed(0)} st`} /><Control label="KEYTRACK" value={patch.filter.keytrack} onChange={(keytrack) => change({ filter: { ...patch.filter, keytrack } })} format={percent} /></div>
        <details className="poly-inline-detail"><summary>VOICE GATE</summary><Control label="GATE" value={patch.gate} min={.05} max={2} step={.01} onChange={(gate) => change({ gate })} format={(value) => `${value.toFixed(2)}×`} /></details>
      </>}

      {page === 'env' && <>
        <SelectorRow label="Envelope" options={(['ampEnvelope', 'filterEnvelope', 'modEnvelope'] as const)} selected={envelopeKey} labelFor={(item) => envelopeLabels[item]} onSelect={setEnvelopeKey} />
        <PolyDisplay eyebrow={`${envelopeLabels[envelopeKey]} ENVELOPE`} value={`${seconds(envelope.attackSeconds)} ATTACK`}><EnvelopeVisual envelope={envelope} /></PolyDisplay>
        <EnvelopeControls value={envelope} onChange={(value) => change({ [envelopeKey]: value })} />
      </>}

      {page === 'mod' && <>
        <SelectorRow label="Modulation source" options={primaryModSources} selected={modSource} labelFor={sourceLabel} onSelect={(source) => { setModSource(source); setRoutePickerOpen(false) }} />
        <div className="poly-performance-sources"><span>PERFORMANCE</span><SelectorRow label="Performance modulation source" options={performanceModSources} selected={performanceModSources.includes(modSource) ? modSource : null} labelFor={sourceLabel} onSelect={(source) => { setModSource(source); setRoutePickerOpen(false) }} /></div>
        <PolyDisplay eyebrow={`${sourceLabel(modSource)} / MODULATION`} value={`${activeRoutes.length} ACTIVE ${activeRoutes.length === 1 ? 'ROUTE' : 'ROUTES'}`}>
          {modSource === 'lfo1' || modSource === 'lfo2' ? <LfoVisual value={patch[modSource]} /> : modSource === 'modEnv' ? <EnvelopeVisual envelope={patch.modEnvelope} /> : <PerformanceModVisual source={modSource} />}
        </PolyDisplay>
        {(modSource === 'lfo1' || modSource === 'lfo2') && <LfoControls value={patch[modSource]} onChange={(value) => change({ [modSource]: value })} />}
        {modSource === 'modEnv' && <EnvelopeControls value={patch.modEnvelope} onChange={(modEnvelope) => change({ modEnvelope })} />}
        <section className="poly-route-section" aria-label={`${sourceLabel(modSource)} destinations`}>
          <div className="poly-route-heading"><div><span>DESTINATIONS</span><strong>{sourceLabel(modSource)}</strong></div><button className="mixer-toggle" type="button" disabled={availableDestinations.length === 0} aria-expanded={routePickerOpen} onClick={() => setRoutePickerOpen((current) => !current)}>+ ROUTE</button></div>
          {activeRoutes.length === 0 ? <p className="poly-empty-routes">NO ACTIVE ROUTES</p> : <div className="poly-active-routes">{activeRoutes.map((route) => <div className="poly-route" key={route.destination}><Control label={destinationLabel(route.destination)} value={route.amount} min={-1} max={1} step={.01} format={signedPercent} onChange={(amount) => updateRoute(route.destination, amount)} /><button className="poly-route-remove" type="button" aria-label={`Remove ${destinationLabel(route.destination)} route`} onClick={() => updateRoute(route.destination, 0)}>×</button></div>)}</div>}
          {routePickerOpen && <label className="poly-route-picker"><span>ADD DESTINATION</span><select value="" onChange={(event) => { const destination = event.target.value as PolyModDestination; if (destination) updateRoute(destination, .25); setRoutePickerOpen(false) }}><option value="">SELECT…</option>{availableDestinations.map((destination) => <option key={destination} value={destination}>{destinationLabel(destination)}</option>)}</select></label>}
        </section>
      </>}
    </div>

    <div className="poly-tools sound-tools-row"><span>SCALE / {props.projectKeyLabel}</span><div><button type="button" disabled={props.projectBusy} onClick={props.onMapToProjectScale}>MAP</button><button type="button" onClick={props.onClear}>CLEAR</button></div></div>
  </section>
}

function SelectorRow<T extends string>({ label, options, selected, labelFor, onSelect, className = '' }: { label: string; options: readonly T[]; selected: T | null; labelFor: (value: T) => string; onSelect: (value: T) => void; className?: string }) {
  return <div className={`poly-selector-row ${className}`} role="group" aria-label={label}>{options.map((option) => <SelectorButton key={option} label={labelFor(option)} selected={selected === option} onClick={() => onSelect(option)} />)}</div>
}

function SelectorButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return <button type="button" className={selected ? 'poly-selector-key poly-selector-key-active' : 'poly-selector-key'} data-mechanism="selector" data-engaged={selected} aria-pressed={selected} onClick={onClick}><span data-mechanism-face>{label}</span></button>
}

function PolyDisplay({ eyebrow, value, children }: { eyebrow: string; value: string; children: React.ReactNode }) {
  return <div className="poly-display">
    <div className="poly-display-glass">
      <div className="poly-display-readout"><span>{eyebrow}</span><output>{value}</output></div>
      <div className="poly-display-visual">{children}</div>
    </div>
  </div>
}

function WavetableVisual({ tableId, position, readWaveform }: { tableId: string; position: number; readWaveform: Props['readWaveform'] }) {
  const path = useMemo(() => {
    const table = generatePolyWavetable(tableId)
    const frames = table.levels[table.levels.length - 1].frames
    return makePath(180, (ratio) => interpolateWavetablePosition(frames, position, Math.round(ratio * (frames[0].length - 1))))
  }, [position, tableId])
  return <svg viewBox="0 0 640 180" preserveAspectRatio="none" role="img" aria-label="Current wavetable waveform"><DisplayGrid /><OscilloscopeTrace staticPath={path} readWaveform={readWaveform} /></svg>
}

function FilterVisual({ mode, cutoffHz, resonance }: { mode: PolyFilterMode; cutoffHz: number; resonance: number }) {
  const path = useMemo(() => {
    const cutoffRatio = Math.log(cutoffHz / 20) / Math.log(1000)
    const q = Math.max(.2, resonance / 4)
    return makePath(180, (ratio) => {
      const relative = 10 ** ((ratio - cutoffRatio) * 3)
      const denominator = Math.sqrt((1 - relative * relative) ** 2 + (relative / q) ** 2)
      const lp = 1 / Math.max(.12, denominator)
      const hp = relative * relative / Math.max(.12, denominator)
      const bp = relative / Math.max(.12, denominator)
      const notch = Math.abs(1 - relative * relative) / Math.max(.12, denominator)
      const response = mode === 'LP12' ? Math.sqrt(lp) : mode === 'LP24' ? lp : mode === 'HP12' ? Math.sqrt(hp) : mode === 'BP12' ? bp : notch
      return Math.min(1, Math.max(0, response)) * 1.7 - .85
    })
  }, [cutoffHz, mode, resonance])
  return <svg viewBox="0 0 640 180" preserveAspectRatio="none" role="img" aria-label={`${mode} filter response`}><DisplayGrid /><SignalTrace path={path} /></svg>
}

function EnvelopeVisual({ envelope }: { envelope: PolyEnvelopeState }) {
  const total = Math.max(.2, envelope.attackSeconds + envelope.decaySeconds + envelope.releaseSeconds)
  const attackX = Math.min(.34, .08 + envelope.attackSeconds / total * .36)
  const decayX = Math.min(.68, attackX + .1 + envelope.decaySeconds / total * .28)
  const releaseX = Math.max(.78, 1 - envelope.releaseSeconds / total * .18)
  const sustainY = 168 - envelope.sustain * 146
  const path = `M 10 168 L ${10 + attackX * 620} 12 L ${10 + decayX * 620} ${sustainY} L ${10 + releaseX * 620} ${sustainY} L 630 168`
  return <svg viewBox="0 0 640 180" preserveAspectRatio="none" role="img" aria-label="Envelope shape"><DisplayGrid /><SignalTrace path={path} /></svg>
}

function LfoVisual({ value }: { value: PolyLfoState }) {
  const path = useMemo(() => makePath(180, (ratio) => lfoSample(value.shape, ratio + value.phase)), [value.phase, value.shape])
  return <svg viewBox="0 0 640 180" preserveAspectRatio="none" role="img" aria-label={`${value.shape} LFO waveform`}><DisplayGrid /><SignalTrace path={path} /></svg>
}

function PerformanceModVisual({ source }: { source: 'velocity' | 'keytrack' }) {
  const path = source === 'velocity' ? 'M 10 166 C 176 164 300 118 414 66 S 570 18 630 12' : 'M 10 168 L 630 12'
  return <svg viewBox="0 0 640 180" preserveAspectRatio="none" role="img" aria-label={`${sourceLabel(source)} modulation context`}><DisplayGrid /><SignalTrace path={path} /></svg>
}

function DisplayGrid() {
  return <g aria-hidden="true">
    <rect className="poly-display-frame" x="10" y="12" width="620" height="156" />
    <path className="poly-display-grid poly-display-grid-minor" d="M10 38H630M10 90H630M10 142H630M87.5 12V168M242.5 12V168M397.5 12V168M552.5 12V168" />
    <path className="poly-display-grid poly-display-grid-major" d="M10 12H630M10 64H630M10 116H630M10 168H630M10 12V168M165 12V168M320 12V168M475 12V168M630 12V168" />
    <path className="poly-display-axis" d="M10 90H630M320 12V168" />
    <path className="poly-display-ticks" d="M10 85V95M87.5 87V93M165 85V95M242.5 87V93M320 83V97M397.5 87V93M475 85V95M552.5 87V93M630 85V95M315 12H325M317 38H323M315 64H325M317 90H323M315 116H325M317 142H323M315 168H325" />
  </g>
}

function SignalTrace({ path }: { path: string }) {
  return <><path className="poly-signal-persistence" d={path} /><path className="poly-signal-line" d={path} /></>
}

function OscilloscopeTrace({ staticPath, readWaveform }: { staticPath: string; readWaveform: Props['readWaveform'] }) {
  const persistenceRef = useRef<SVGPathElement>(null)
  const traceRef = useRef<SVGPathElement>(null)
  const staticPathRef = useRef(staticPath)
  const readWaveformRef = useRef(readWaveform)
  const renderedPathRef = useRef(staticPath)
  const liveRef = useRef(false)
  staticPathRef.current = staticPath
  readWaveformRef.current = readWaveform

  useEffect(() => {
    const samples = new Float32Array(1024)
    let animationFrame = 0
    let lastDrawAt = 0
    let quietFrames = 0

    const setPath = (path: string) => {
      if (path === renderedPathRef.current) return
      renderedPathRef.current = path
      persistenceRef.current?.setAttribute('d', path)
      traceRef.current?.setAttribute('d', path)
    }

    const draw = (timestamp: number) => {
      animationFrame = requestAnimationFrame(draw)
      if (document.hidden || timestamp - lastDrawAt < 1000 / 30) return
      lastDrawAt = timestamp
      if (!readWaveformRef.current(samples)) { liveRef.current = false; setPath(staticPathRef.current); return }

      let peak = 0
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
      if (peak < .002) {
        quietFrames += 1
        if (quietFrames >= 6) { liveRef.current = false; setPath(staticPathRef.current) }
        return
      }

      quietFrames = 0
      liveRef.current = true
      setPath(makeLiveWaveformPath(samples))
    }

    animationFrame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animationFrame)
  }, [])

  useEffect(() => {
    if (!liveRef.current) {
      renderedPathRef.current = staticPath
      persistenceRef.current?.setAttribute('d', staticPath)
      traceRef.current?.setAttribute('d', staticPath)
    }
  }, [staticPath])

  return <><path ref={persistenceRef} className="poly-signal-persistence" d={staticPath} /><path ref={traceRef} className="poly-signal-line" d={staticPath} /></>
}

function makeLiveWaveformPath(samples: Float32Array<ArrayBuffer>): string {
  let trigger = 0
  const triggerLimit = Math.floor(samples.length * .45)
  for (let index = 1; index < triggerLimit; index += 1) {
    if (samples[index - 1] <= 0 && samples[index] > 0) { trigger = index; break }
  }
  const available = Math.max(1, samples.length - trigger)
  return makePath(180, (ratio) => samples[trigger + Math.min(available - 1, Math.floor(ratio * (available - 1)))] * 1.8)
}

function EnvelopeControls({ value, onChange }: { value: PolyEnvelopeState; onChange: (value: PolyEnvelopeState) => void }) {
  const change = (changes: Partial<PolyEnvelopeState>) => onChange({ ...value, ...changes })
  return <div className="poly-control-grid poly-envelope-controls"><Control label="ATTACK" value={value.attackSeconds} min={0} max={10} step={.005} onChange={(attackSeconds) => change({ attackSeconds })} format={seconds} /><Control label="DECAY" value={value.decaySeconds} min={0} max={10} step={.005} onChange={(decaySeconds) => change({ decaySeconds })} format={seconds} /><Control label="SUSTAIN" value={value.sustain} onChange={(sustain) => change({ sustain })} format={percent} /><Control label="RELEASE" value={value.releaseSeconds} min={.005} max={15} step={.005} onChange={(releaseSeconds) => change({ releaseSeconds })} format={seconds} /></div>
}

function LfoControls({ value, onChange }: { value: PolyLfoState; onChange: (value: PolyLfoState) => void }) {
  const change = (changes: Partial<PolyLfoState>) => onChange({ ...value, ...changes })
  return <div className="poly-lfo-editor">
    <label className="poly-select-control"><span>SHAPE</span><select value={value.shape} onChange={(event) => change({ shape: event.target.value as PolyLfoState['shape'] })}>{polyLfoShapes.map((shape) => <option value={shape} key={shape}>{shape.toUpperCase()}</option>)}</select></label>
    <SelectorRow label="LFO timing mode" options={(['sync', 'free'] as const)} selected={value.mode} labelFor={(mode) => mode.toUpperCase()} onSelect={(mode) => change({ mode })} />
    {value.mode === 'sync' ? <label className="poly-select-control"><span>DIVISION</span><select value={value.division} onChange={(event) => change({ division: event.target.value as PolyLfoState['division'] })}>{polyLfoDivisions.map((division) => <option value={division} key={division}>{division}</option>)}</select></label> : <Control label="RATE" value={value.rateHz} min={.01} max={30} step={.01} onChange={(rateHz) => change({ rateHz })} format={(rate) => `${rate.toFixed(2)} Hz`} />}
    <button type="button" className={value.retrigger ? 'poly-latch poly-latch-active' : 'poly-latch'} aria-pressed={value.retrigger} onClick={() => change({ retrigger: !value.retrigger })}>RETRIGGER</button>
    <Control label="PHASE" value={value.phase} onChange={(phase) => change({ phase })} format={percent} />
    <Control label="FADE IN" value={value.fadeInSeconds} min={0} max={10} step={.01} onChange={(fadeInSeconds) => change({ fadeInSeconds })} format={seconds} />
  </div>
}

function Control({ label, value, min = 0, max = 1, step = .01, format, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; format: (value: number) => string; onChange: (value: number) => void }) {
  const drag = useDragSlider({ value, min, max, step, onChange, focusLabel: label, formatValue: format })
  return <label className="poly-control"><span>{label}</span><output>{format(value)}</output><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} onPointerDown={drag.onPointerDown} /></label>
}

function makePath(points: number, sample: (ratio: number) => number): string {
  return Array.from({ length: points }, (_, index) => {
    const ratio = index / (points - 1)
    const x = 10 + ratio * 620
    const y = 90 - Math.min(1, Math.max(-1, sample(ratio))) * 78
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

function lfoSample(shape: PolyLfoState['shape'], rawPhase: number): number {
  const phase = ((rawPhase % 1) + 1) % 1
  if (shape === 'sine') return Math.sin(phase * Math.PI * 2)
  if (shape === 'triangle') return 1 - 4 * Math.abs(phase - .5)
  if (shape === 'saw') return phase * 2 - 1
  if (shape === 'ramp') return 1 - phase * 2
  if (shape === 'square') return phase < .5 ? 1 : -1
  const step = Math.floor(phase * 12)
  return ((step * 9301 + 49297) % 233280) / 116640 - 1
}

const percent = (value: number) => `${Math.round(value * 100)}%`
const signedPercent = (value: number) => `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`
const signed = (value: number) => `${value > 0 ? '+' : ''}${Math.round(value)}`
const seconds = (value: number) => value < 1 ? `${Math.round(value * 1000)} ms` : `${value.toFixed(2)} s`
const frequency = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${Math.round(value)} Hz`
const sourceLabel = (source: PolyModSource) => ({ lfo1: 'LFO 1', lfo2: 'LFO 2', modEnv: 'MOD ENV', velocity: 'VELOCITY', keytrack: 'KEYTRACK' }[source])
const destinationLabel = (destination: PolyModDestination) => ({ osc1Position: 'WT1 POSITION', osc2Position: 'WT2 POSITION', osc1Pitch: 'OSC 1 PITCH', osc2Pitch: 'OSC 2 PITCH', osc1Fine: 'OSC 1 FINE', osc2Fine: 'OSC 2 FINE', oscMix: 'OSC MIX', fmAmount: 'FM AMOUNT', filterCutoff: 'FILTER CUTOFF', filterResonance: 'FILTER RESONANCE', filterDrive: 'FILTER DRIVE', filterEnvAmount: 'FILTER ENV AMOUNT', ampLevel: 'AMP LEVEL', pan: 'PAN', unisonDetune: 'UNISON DETUNE', width: 'WIDTH', lfo1Rate: 'LFO 1 RATE' }[destination])
const wavetableLabel = (tableId: string) => polyWavetableBank.find((table) => table.id === tableId)?.name ?? tableId.toUpperCase()
