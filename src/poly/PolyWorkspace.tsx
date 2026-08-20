import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PadState } from '../pads/types'
import { useDragSlider } from '../shell/useDragSlider'
import { UserSynthPresetControls } from '../synth-presets/UserSynthPresetControls'
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
  const [patchPanelOpen, setPatchPanelOpen] = useState(false)
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

  return <section className="poly-workspace" aria-label={`ZOLA-X editor for ${props.pad.label}`}>
    {/* The screen leads on every page - it is the thing you came here to
        shape, and its top edge never moves when you switch pages, because
        nothing above it ever changes. The bank, the sub-selector and the
        patch latch are a control strip under the glass now, not paperwork
        stacked above it. */}
    {page === 'osc' && <PolyDisplay eyebrow={`${oscillatorKey === 'oscillator1' ? 'OSC 1' : 'OSC 2'} / ${wavetableLabel(oscillator.tableId)}`} value={`${Math.round(oscillator.position * 100)}% POSITION`}>
      <WavetableVisual tableId={oscillator.tableId} position={oscillator.position} readWaveform={props.readWaveform} />
    </PolyDisplay>}
    {page === 'filter' && <PolyDisplay eyebrow={`${patch.filter.mode} FILTER`} value={frequency(patch.filter.cutoffHz)}><FilterVisual mode={patch.filter.mode} cutoffHz={patch.filter.cutoffHz} resonance={patch.filter.resonance} /></PolyDisplay>}
    {page === 'env' && <PolyDisplay eyebrow={`${envelopeLabels[envelopeKey]} ENVELOPE`} value={`${seconds(envelope.attackSeconds)} ATTACK`}><EnvelopeVisual envelope={envelope} /></PolyDisplay>}
    {page === 'mod' && <PolyDisplay eyebrow={`${sourceLabel(modSource)} / MODULATION`} value={`${activeRoutes.length} ACTIVE ${activeRoutes.length === 1 ? 'ROUTE' : 'ROUTES'}`}>
      {modSource === 'lfo1' || modSource === 'lfo2' ? <LfoVisual value={patch[modSource]} /> : modSource === 'modEnv' ? <EnvelopeVisual envelope={patch.modEnvelope} /> : <PerformanceModVisual source={modSource} />}
    </PolyDisplay>}

    <SectionBank page={page} onSelect={(item) => { setPage(item); setRoutePickerOpen(false) }} />

    {/* The sub-selector is as wide as its own words, which left most of this
        line empty. The way out, the patch latch and the audition key live in
        that space rather than in a strip of their own - and the pad's own
        paperwork is gone entirely, since nothing about it changes while you
        play. */}
    <div className="poly-subrow">
      {page === 'osc' && <ModeSelector label="Oscillator" className="poly-subpages" options={(['oscillator1', 'oscillator2'] as const)} selected={oscillatorKey} labelFor={(item) => item === 'oscillator1' ? 'OSC 1' : 'OSC 2'} onSelect={(item) => { setOscillatorKey(item); setOscillatorDetail(null) }} />}
      {page === 'filter' && <ModeSelector label="Filter mode" className="poly-subpages" options={polyFilterModes} selected={patch.filter.mode} labelFor={(mode) => mode} onSelect={(mode) => change({ filter: { ...patch.filter, mode } })} />}
      {page === 'env' && <ModeSelector label="Envelope" className="poly-subpages" options={(['ampEnvelope', 'filterEnvelope', 'modEnvelope'] as const)} selected={envelopeKey} labelFor={(item) => envelopeLabels[item]} onSelect={setEnvelopeKey} />}
      {page === 'mod' && <ModeSelector label="Modulation source" className="poly-subpages" options={primaryModSources} selected={modSource} labelFor={sourceLabel} onSelect={(source) => { setModSource(source); setRoutePickerOpen(false) }} />}
      {/* One group, so that when FILTER's five-position switch pushes them onto
          a second line they travel together and stay against the right edge. */}
      <div className="poly-subrow-keys">
        <ActionKey label="← SYNTHS" ariaLabel="Back to synths" onClick={props.onBack} />
        <ActionKey label="PATCH" expanded={patchPanelOpen} onClick={() => setPatchPanelOpen((current) => !current)} />
        <button className="poly-audition" type="button" disabled={!props.audioReady} aria-label="Hold to play ZOLA-X" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); props.onTrigger() }} onPointerUp={props.onRelease} onPointerCancel={props.onRelease} onLostPointerCapture={props.onRelease} />
      </div>
    </div>

    {patchPanelOpen && <div className="poly-patch-panel station-card" aria-label="ZOLA-X patch storage">
      <label className="poly-preset"><span className="station-label-section">STARTING PATCH</span><select className="station-select-name" value={polyFactoryPatches.find((item) => item.name === patch.name)?.id ?? ''} onChange={(event) => props.onPatchChange(applyPolyFactoryPatch(patch, event.target.value))}><option value="" disabled>CUSTOM</option>{polyFactoryPatches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <UserSynthPresetControls kind="zola-x" instrumentLabel="ZOLA-X" patch={patch} onApply={props.onPatchChange} />
    </div>}

    <div className="poly-editor-panel">
      {page === 'osc' && <>
        <div className="poly-osc-selects">
          <label className="poly-table"><span>TABLE</span><select value={oscillator.tableId} onChange={(event) => change({ [oscillatorKey]: { ...oscillator, tableId: event.target.value } })}>{polyWavetableBank.map((item) => <option value={item.id} key={item.id}>{item.family} / {item.name}</option>)}</select></label>
          <label className="poly-select-control"><span>UNISON</span><select value={oscillator.unison} onChange={(event) => change({ [oscillatorKey]: { ...oscillator, unison: Number(event.target.value) as PolyOscillatorState['unison'] } })}>{polyUnisonCounts.map((count) => <option value={count} key={count}>{count}</option>)}</select></label>
        </div>
        <div className="poly-osc-main-controls">
          <Control label="POSITION" value={oscillator.position} onChange={(position) => change({ [oscillatorKey]: { ...oscillator, position } })} format={percent} />
          <Control label="LEVEL" value={oscillator.level} onChange={(level) => change({ [oscillatorKey]: { ...oscillator, level } })} format={percent} />
        </div>
        {/* Detail pages are consulted, not performed. One compact data window
            chooses the current detail without making three permanent tabs
            compete with the oscillator's actual controls. */}
        <label className="poly-detail-selector">
          <span>DETAIL</span>
          <select
            aria-label="Oscillator detail"
            value={oscillatorDetail ?? ''}
            onChange={(event) => {
              const detail = event.target.value
              if (detail === 'tune' || detail === 'spread' || detail === 'output') setOscillatorDetail(detail)
            }}
          >
            <option value="" disabled>SELECT</option>
            <option value="tune">TUNE</option>
            <option value="spread">SPREAD</option>
            <option value="output">OUTPUT</option>
          </select>
        </label>
        {oscillatorDetail === 'tune' && <div className="poly-secondary-panel poly-secondary-panel-3" aria-label="Oscillator tuning"><Control label="OCTAVE" value={oscillator.octave} min={-2} max={2} step={1} onChange={(octave) => change({ [oscillatorKey]: { ...oscillator, octave } })} format={signed} /><Control label="SEMITONE" value={oscillator.semitone} min={-12} max={12} step={1} onChange={(semitone) => change({ [oscillatorKey]: { ...oscillator, semitone } })} format={signed} /><Control label="FINE" value={oscillator.fineCents} min={-100} max={100} step={1} onChange={(fineCents) => change({ [oscillatorKey]: { ...oscillator, fineCents } })} format={(value) => `${signed(value)} ct`} /></div>}
        {oscillatorDetail === 'spread' && <div className="poly-secondary-panel" aria-label="Oscillator spread"><Control label="DETUNE" value={oscillator.detuneCents} min={0} max={50} step={1} onChange={(detuneCents) => change({ [oscillatorKey]: { ...oscillator, detuneCents } })} format={(value) => `${value.toFixed(0)} ct`} /><Control label="WIDTH" value={oscillator.width} onChange={(width) => change({ [oscillatorKey]: { ...oscillator, width } })} format={percent} /></div>}
        {oscillatorDetail === 'output' && <div className="poly-secondary-panel" aria-label="Patch output"><Control label="MASTER LEVEL" value={patch.level} onChange={(level) => change({ level })} format={percent} /><Control label="PAN" value={patch.pan} min={-1} max={1} onChange={(pan) => change({ pan })} format={signedPercent} /></div>}
        <div className="poly-common-area">
          <p>OSC 1 <span>MIX / CROSS-MOD</span> OSC 2</p>
          <div className="poly-common-controls"><Control label="OSC MIX" value={patch.oscillatorMix} onChange={(oscillatorMix) => change({ oscillatorMix })} format={percent} /><Control label="OSC 2 → OSC 1 FM" value={patch.fmAmount} onChange={(fmAmount) => change({ fmAmount })} format={percent} /></div>
        </div>
      </>}

      {page === 'filter' && <>
        <div className="poly-control-grid poly-filter-controls"><Control label="CUTOFF" value={patch.filter.cutoffHz} min={20} max={20000} step={1} onChange={(cutoffHz) => change({ filter: { ...patch.filter, cutoffHz } })} format={frequency} /><Control label="RESONANCE" value={patch.filter.resonance} min={.5} max={20} step={.1} onChange={(resonance) => change({ filter: { ...patch.filter, resonance } })} format={(value) => value.toFixed(1)} /><Control label="DRIVE" value={patch.filter.drive} onChange={(drive) => change({ filter: { ...patch.filter, drive } })} format={percent} /><Control label="ENV AMOUNT" value={patch.filter.envelopeAmountSemitones} min={-60} max={60} step={1} onChange={(envelopeAmountSemitones) => change({ filter: { ...patch.filter, envelopeAmountSemitones } })} format={(value) => `${value > 0 ? '+' : ''}${value.toFixed(0)} st`} /><Control label="KEYTRACK" value={patch.filter.keytrack} onChange={(keytrack) => change({ filter: { ...patch.filter, keytrack } })} format={percent} /><Control label="VOICE GATE" value={patch.gate} min={.05} max={2} step={.01} onChange={(gate) => change({ gate })} format={(value) => `${value.toFixed(2)}×`} /></div>
      </>}

      {page === 'env' && <>
        <EnvelopeControls value={envelope} onChange={(value) => change({ [envelopeKey]: value })} />
      </>}

      {page === 'mod' && <>
        {/* The same five-way choice as the sub-selector line above, split over
            two rows by where a source comes from, so both halves are the same
            family of part and only one lamp is lit across the pair. */}
        <div className="poly-performance-sources"><span>PERFORMANCE</span><ModeSelector label="Performance modulation source" options={performanceModSources} selected={performanceModSources.includes(modSource) ? modSource : null} labelFor={sourceLabel} onSelect={(source) => { setModSource(source); setRoutePickerOpen(false) }} /></div>
        {(modSource === 'lfo1' || modSource === 'lfo2') && <LfoControls value={patch[modSource]} onChange={(value) => change({ [modSource]: value })} />}
        {modSource === 'modEnv' && <EnvelopeControls value={patch.modEnvelope} onChange={(modEnvelope) => change({ modEnvelope })} />}
        <section className="poly-route-section" aria-label={`${sourceLabel(modSource)} destinations`}>
          <div className="poly-route-heading"><div><span>DESTINATIONS</span><strong>{sourceLabel(modSource)}</strong></div><ActionKey label="+ ROUTE" disabled={availableDestinations.length === 0} expanded={routePickerOpen} onClick={() => setRoutePickerOpen((current) => !current)} /></div>
          {activeRoutes.length === 0 ? <p className="poly-empty-routes">NO ACTIVE ROUTES</p> : <div className="poly-active-routes">{activeRoutes.map((route) => <div className="poly-route" key={route.destination}><Control label={destinationLabel(route.destination)} value={route.amount} min={-1} max={1} step={.01} format={signedPercent} onChange={(amount) => updateRoute(route.destination, amount)} /><ActionKey label="×" ariaLabel={`Remove ${destinationLabel(route.destination)} route`} onClick={() => updateRoute(route.destination, 0)} /></div>)}</div>}
          {routePickerOpen && <label className="poly-route-picker"><span>ADD DESTINATION</span><select value="" onChange={(event) => { const destination = event.target.value as PolyModDestination; if (destination) updateRoute(destination, .25); setRoutePickerOpen(false) }}><option value="">SELECT…</option>{availableDestinations.map((destination) => <option key={destination} value={destination}>{destinationLabel(destination)}</option>)}</select></label>}
        </section>
      </>}
    </div>

    <div className="poly-tools sound-tools-row"><span>SCALE / {props.projectKeyLabel}</span><div><button type="button" disabled={props.projectBusy} onClick={props.onMapToProjectScale}>MAP</button><button type="button" onClick={props.onClear}>CLEAR</button></div></div>
  </section>
}

/* ---- Three families of hard part ------------------------------------------
   The panel used to answer every question with the same key at two sizes: the
   section it was on, which oscillator it was editing, and what SPREAD would
   reveal all looked alike, so the instrument had to be read before it could be
   used. It is three different pieces of hardware now, told apart by where each
   one sits in the plate:

     bank    sunk into it   - four faces flush inside one milled bay
     key     standing on it - a slab on a hard drop and a contact shadow
     mode    flush with it  - a lamp and a legend lying in a shallow trough

   That order is also the order of consequence. The bank is the widest part on
   the instrument and moves the whole panel under it; an action key does one
   thing and carries the mass to say so; a mode position only reports which
   member of the current section is live, so it takes no relief and no key face
   at all. The hierarchy is legible before a word of it is.

   None of the three carries [data-mechanism]. The shared grammar in index.css
   paints one rest shadow and one engaged shadow for every family that opts in,
   which is exactly the single voice this pass is undoing - and it loads after
   this file, so opting in would mean fighting it at (0,4,0) on every rule.
   These parts own their own depth instead, and repeat the parts of that
   grammar that are not about material: focus, disabled and reduced motion. */

/* The bank. Engaged is not a lit key - it is a key that has gone down and
   changed material, to the matte floor of the bay, with the wall above casting
   into it and a milled index groove cut under the legend. */
function SectionBank({ page, onSelect }: { page: Page; onSelect: (page: Page) => void }) {
  return <div className="poly-pages" role="group" aria-label="POLY section">
    {(['osc', 'filter', 'env', 'mod'] as const).map((item) => <button
      key={item}
      type="button"
      className="poly-page-key"
      data-engaged={page === item}
      aria-pressed={page === item}
      onClick={() => onSelect(item)}
    ><span className="poly-page-face">{pageLabels[item]}<span className="poly-lamp" aria-hidden="true" /></span></button>)}
  </div>
}

/* A mode position: a lens and a legend lying in the same shallow cut the
   shuttle guides run in, positions parted by a detent notch. The lamp is the
   state - no fill, no coloured legend, no bloom around the lit one - and it
   lights in the amber the screen already draws in, so the instrument has one
   ink for information and one pigment for the play key.

   The painted part is 7px across. The target is the whole row. */
function ModeSelector<T extends string>({ label, options, selected, labelFor, onSelect, className = '' }: { label: string; options: readonly T[]; selected: T | null; labelFor: (value: T) => string; onSelect: (value: T) => void; className?: string }) {
  return <div className={className ? `poly-modes ${className}` : 'poly-modes'} role="group" aria-label={label}>
    {options.map((option) => <button
      key={option}
      type="button"
      className="poly-mode"
      data-engaged={selected === option}
      aria-pressed={selected === option}
      onClick={() => onSelect(option)}
    ><span className="poly-lamp" aria-hidden="true" /><span className="poly-mode-legend">{labelFor(option)}</span></button>)}
  </div>
}

/**
 * An action key: a square-shouldered slab standing proud of the plate on a
 * hard drop and a contact shadow, which is the same trick that makes the
 * shuttle read as a part rather than as print. Engaged is the slab seated down
 * into the plate, never a fill of colour.
 *
 * `lamp` is for a true binary state that has to be read while playing. A key
 * that merely reveals a panel does not get one - the open panel says so
 * already, and a lamp on every key would put the mode selectors' one signal
 * back into general circulation.
 */
function ActionKey({ label, ariaLabel, tier = '3', engaged, expanded, lamp = false, disabled, onClick }: { label: string; ariaLabel?: string; tier?: '2' | '3'; engaged?: boolean; expanded?: boolean; lamp?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button
    type="button"
    className="poly-key"
    data-tier={tier}
    data-engaged={engaged ?? expanded ?? false}
    aria-label={ariaLabel}
    aria-pressed={engaged}
    aria-expanded={expanded}
    disabled={disabled}
    onClick={onClick}
  ><span className="poly-key-face">{lamp && <span className="poly-lamp" aria-hidden="true" />}{label}</span></button>
}

function PolyDisplay({ eyebrow, value, children }: { eyebrow: string; value: string; children: React.ReactNode }) {
  return <div className="poly-display">
    <div className="poly-display-glass">
      <div className="poly-display-readout"><span>{eyebrow}</span><output>{value}</output></div>
      <div className="poly-display-visual">{children}</div>
    </div>
  </div>
}

/* ---- Wavetable ------------------------------------------------------------
   Oblique projection: each step back is shifted right and up by a fixed amount,
   every trace the same size, no vanishing point. That is the projection a
   drawing gets when it has to stay measurable, and it is why this reads as
   depth without reading as a render.

   The geometry is set so the whole band sits centred in the glass. The first
   version climbed steeply - six units up per step - which pushed the front
   trace to 79% of the height, hard against the bottom edge, and left the top
   third empty. Flattening the climb to three and spending the difference
   sideways centres the stack and turns it into a ribbon lying across the
   screen rather than a staircase leaning out of it.

   Both axes are centred on the front trace, which is the one that matters -
   it is the live output, and the rest is its wake. Vertically the whole band
   is centred: amplitude*2 + total climb = 76 + 33 = 109 in a 180 viewBox, so it
   clears 35 above and 35 below. Horizontally the front trace alone is centred,
   which means the deepest layers of the wake run off the right edge and get
   clipped by the glass. That is the right trade: a wake leaving the screen
   reads as depth, a main trace pinned to the left edge reads as a mistake. */
const wavetableOriginX = 50
const wavetableDepthX = 11
const wavetableDepthY = 3
const wavetableWidth = 540
const wavetableBaseline = 106
const wavetableAmplitude = 38

function wavetablePath(sample: (ratio: number) => number, depth: number): string {
  const originX = wavetableOriginX + depth * wavetableDepthX
  const originY = wavetableBaseline - depth * wavetableDepthY
  return Array.from({ length: 120 }, (_, index) => {
    const ratio = index / 119
    const x = originX + ratio * wavetableWidth
    const y = originY - Math.min(1, Math.max(-1, sample(ratio))) * wavetableAmplitude
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

/**
 * The stack behind the front line is that line's own past.
 *
 * Two earlier attempts drew the frames of the wavetable back there, and both
 * read as dead for the same reason: the front line is the live oscilloscope
 * and moves with the audio at thirty frames a second, while table frames only
 * change when you touch something. One line alive in front of eleven frozen
 * ones looks like a lit trace over a painted backdrop, which is exactly what
 * it was.
 *
 * So the depth axis is time now. Every tick the current trace is pushed onto a
 * ring of past traces and the whole ring shifts one step further back, which
 * makes the stack a wake travelling away from the wave that made it. Sweeping
 * POSITION sends the new shape rippling backwards through it over a third of a
 * second; playing a note turns the whole thing into a waterfall.
 *
 * Depth is a group translate, so each entry stores one path measured at the
 * front plane and nothing has to be re-projected as it recedes. React paints
 * the elements once and the loop only ever touches `d` attributes.
 */
const wavetableTrail = 12

function WavetableTrail({ staticPath, readWaveform }: { staticPath: string; readWaveform: Props['readWaveform'] }) {
  const pathsRef = useRef<(SVGPathElement | null)[]>([])
  const historyRef = useRef<string[]>(Array.from({ length: wavetableTrail }, () => staticPath))
  const staticPathRef = useRef(staticPath)
  const readWaveformRef = useRef(readWaveform)
  staticPathRef.current = staticPath
  readWaveformRef.current = readWaveform

  useEffect(() => {
    const samples = new Float32Array(1024)
    let animationFrame = 0
    let lastDrawAt = 0

    const draw = (timestamp: number) => {
      animationFrame = requestAnimationFrame(draw)
      if (document.hidden || timestamp - lastDrawAt < 1000 / 30) return
      lastDrawAt = timestamp

      let next = staticPathRef.current
      if (readWaveformRef.current(samples)) {
        let peak = 0
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
        if (peak >= .002) next = makeLiveWaveformPath(samples)
      }

      const history = historyRef.current
      history.unshift(next)
      history.length = wavetableTrail
      for (let depth = 0; depth < wavetableTrail; depth += 1) pathsRef.current[depth]?.setAttribute('d', history[depth])
    }

    animationFrame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animationFrame)
  }, [])

  /* Far first, so the near traces paint over the ones already receding. */
  return <>
    {Array.from({ length: wavetableTrail }, (_, index) => wavetableTrail - 1 - index).map((depth) => (
      <g key={depth} transform={`translate(${(depth * wavetableDepthX).toFixed(2)} ${(-depth * wavetableDepthY).toFixed(2)})`}>
        <path
          ref={(node) => { pathsRef.current[depth] = node }}
          className={depth === 0 ? 'poly-signal-line' : 'poly-wavetable-frame'}
          style={depth === 0 ? undefined : { opacity: .44 - depth * .033 } as CSSProperties}
          d={staticPath}
        />
      </g>
    ))}
  </>
}

function WavetableVisual({ tableId, position, readWaveform }: { tableId: string; position: number; readWaveform: Props['readWaveform'] }) {
  const path = useMemo(() => {
    const table = generatePolyWavetable(tableId)
    const source = table.levels[table.levels.length - 1].frames
    const lastSample = source[0].length - 1
    return wavetablePath((ratio) => interpolateWavetablePosition(source, position, Math.round(ratio * lastSample)), 0)
  }, [position, tableId])

  return <svg viewBox="0 0 640 180" preserveAspectRatio="none" role="img" aria-label="Oscillator output with its recent history receding behind it">
    <WavetableTrail staticPath={path} readWaveform={readWaveform} />
  </svg>
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

/**
 * The graticule behind every ZOLA-X visual - wavetable, filter curve, envelope,
 * LFO and the performance sources alike, so all of them are ruled the same way.
 *
 * It carried a frame, a minor grid, a major grid, a dashed axis and a ruler of
 * tick marks down both centre lines. That is the furniture of a plotting
 * library, and it is most of what made the screen read as a chart in a web
 * page. What an instrument's display actually rules is left: the plot edge, two
 * divisions each way, and a centre cross.
 */
function DisplayGrid() {
  return <g aria-hidden="true">
    <rect className="poly-display-frame" x="10" y="12" width="620" height="156" />
    <path className="poly-display-grid poly-display-grid-major" d="M10 64H630M10 116H630M165 12V168M475 12V168" />
    <path className="poly-display-axis" d="M10 90H630M320 12V168" />
  </g>
}

/* One fine continuous stroke. A dot-mode version of this was tried and read as
   crude at the size the screen actually gets. */
function SignalTrace({ path }: { path: string }) {
  return <path className="poly-signal-line" d={path} />
}


function makeLiveWaveformPath(samples: Float32Array<ArrayBuffer>): string {
  let trigger = 0
  const triggerLimit = Math.floor(samples.length * .45)
  for (let index = 1; index < triggerLimit; index += 1) {
    if (samples[index - 1] <= 0 && samples[index] > 0) { trigger = index; break }
  }
  const available = Math.max(1, samples.length - trigger)
  /* Same projection as the front frame of the stack, so the live signal stands
     exactly where the slice it replaces stood. */
  return wavetablePath((ratio) => samples[trigger + Math.min(available - 1, Math.floor(ratio * (available - 1)))] * 1.8, 0)
}

function EnvelopeControls({ value, onChange }: { value: PolyEnvelopeState; onChange: (value: PolyEnvelopeState) => void }) {
  const change = (changes: Partial<PolyEnvelopeState>) => onChange({ ...value, ...changes })
  return <div className="poly-control-grid poly-envelope-controls"><Control label="ATTACK" value={value.attackSeconds} min={0} max={10} step={.005} onChange={(attackSeconds) => change({ attackSeconds })} format={seconds} /><Control label="DECAY" value={value.decaySeconds} min={0} max={10} step={.005} onChange={(decaySeconds) => change({ decaySeconds })} format={seconds} /><Control label="SUSTAIN" value={value.sustain} onChange={(sustain) => change({ sustain })} format={percent} /><Control label="RELEASE" value={value.releaseSeconds} min={.005} max={15} step={.005} onChange={(releaseSeconds) => change({ releaseSeconds })} format={seconds} /></div>
}

function LfoControls({ value, onChange }: { value: PolyLfoState; onChange: (value: PolyLfoState) => void }) {
  const change = (changes: Partial<PolyLfoState>) => onChange({ ...value, ...changes })
  return <div className="poly-lfo-editor">
    <label className="poly-select-control"><span>SHAPE</span><select value={value.shape} onChange={(event) => change({ shape: event.target.value as PolyLfoState['shape'] })}>{polyLfoShapes.map((shape) => <option value={shape} key={shape}>{shape.toUpperCase()}</option>)}</select></label>
    <ModeSelector label="LFO timing mode" options={(['sync', 'free'] as const)} selected={value.mode} labelFor={(mode) => mode.toUpperCase()} onSelect={(mode) => change({ mode })} />
    {value.mode === 'sync' ? <label className="poly-select-control"><span>DIVISION</span><select value={value.division} onChange={(event) => change({ division: event.target.value as PolyLfoState['division'] })}>{polyLfoDivisions.map((division) => <option value={division} key={division}>{division}</option>)}</select></label> : <Control label="RATE" value={value.rateHz} min={.01} max={30} step={.01} onChange={(rateHz) => change({ rateHz })} format={(rate) => `${rate.toFixed(2)} Hz`} />}
    {/* The one key on the panel carrying a lamp: a true on/off that changes
        the sound and has to be readable at a glance while playing, unlike the
        reveal latches, whose state is the panel they opened. */}
    <ActionKey label="RETRIGGER" tier="2" lamp engaged={value.retrigger} onClick={() => change({ retrigger: !value.retrigger })} />
    <Control label="PHASE" value={value.phase} onChange={(phase) => change({ phase })} format={percent} />
    <Control label="FADE IN" value={value.fadeInSeconds} min={0} max={10} step={.01} onChange={(fadeInSeconds) => change({ fadeInSeconds })} format={seconds} />
  </div>
}

/**
 * Every parameter on ZOLA-X - OSC, FILTER, ENV, MOD and the modulation routes
 * alike - is this one part, so the instrument speaks with a single voice.
 *
 * It began as an etched hairline with a tick ruler and a lit index, which read
 * as a capacitive strip rather than as hardware. What travels now is a real
 * shuttle: a low, wide slug with a machined top face, side walls and a shadow,
 * running in a channel milled into the plate. Position is where the part is,
 * not how far a glow has filled.
 *
 * The whole row is the hit target - a transparent input over label, value and
 * guide alike - so a thumb never has to find the shuttle itself. The drag stays
 * relative, so landing anywhere never jumps the value.
 */
function Control({ label, value, min = 0, max = 1, step = .01, format, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; format: (value: number) => string; onChange: (value: number) => void }) {
  const drag = useDragSlider({ value, min, max, step, onChange, focusLabel: label, formatValue: format })
  return <label className="poly-control">
    <input type="range" value={value} min={min} max={max} step={step} {...drag.inputProps} />
    <span className="poly-control-legend">{label}</span>
    <output>{format(value)}</output>
    <span className="poly-control-track" style={{ '--poly-pos': (value - min) / (max - min) } as CSSProperties} aria-hidden="true">
      <span className="poly-control-shuttle" />
    </span>
  </label>
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
