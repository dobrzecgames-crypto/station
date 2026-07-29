import { StrictMode, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

type Scene = 'chop-manual' | 'seq-problem' | 'system-scattered' | 'library-pad-early' | 'song-early' | 'mix-early'

const padKeys = ['1', '2', '3', '4', 'Q', 'W', 'E', 'R']
const padKeys16 = ['1', '2', '3', '4', 'Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F', 'Z', 'X', 'C', 'V']
const waveformBars = [18, 42, 65, 28, 74, 48, 32, 81, 54, 24, 68, 39, 76, 31, 58, 46, 70, 36, 61, 22, 49, 72, 44, 29]

function ReconstructionLabel({
  title,
  note,
  showClassification = true,
}: {
  title: string
  note: string
  showClassification?: boolean
}) {
  return (
    <header className="lab-header">
      <div>
        <p>STATION / EVOLUTION LAB</p>
        <h1>{title}</h1>
      </div>
      {showClassification ? (
        <div className="reconstructed-label">
          <strong>RECONSTRUCTED EARLY STATE</strong>
          <span>{note}</span>
        </div>
      ) : (
        <p className="lab-source-note">{note}</p>
      )}
    </header>
  )
}

function Waveform() {
  return (
    <div className="waveform" aria-label="Simplified sample waveform">
      <div className="waveform-bars">
        {waveformBars.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
      </div>
      {[21, 47, 72].map((left, index) => <span className="slice-marker" key={left} style={{ left: `${left}%` }}><b>{index + 2}</b></span>)}
    </div>
  )
}

function ManualChopScene() {
  return (
    <main className="prototype-shell phone-prototype chop-phone">
      <ReconstructionLabel
        title="Manual sample chop"
        note="Functional source · 5307ea0"
        showClassification={false}
      />
      <section className="plain-panel">
        <div className="row between">
          <label className="file-control">Source WAV <input type="file" accept=".wav,audio/wav" /></label>
          <button type="button">Preview source</button>
        </div>
        <p className="file-name">break_92bpm.wav · 4.18 s</p>
        <Waveform />
        <div className="row">
          <button className="active-basic" type="button">Add slice marker</button>
          <button type="button">Remove selected marker</button>
          <button type="button">Clear markers</button>
        </div>
      </section>
      <section className="two-column">
        <div className="plain-panel">
          <h2>Slices</h2>
          <ol className="slice-list">
            <li><button type="button">Slice 1</button><span>0.00–0.88 s</span></li>
            <li><button type="button">Slice 2</button><span>0.88–1.96 s</span></li>
            <li><button type="button">Slice 3</button><span>1.96–3.02 s</span></li>
            <li><button type="button">Slice 4</button><span>3.02–4.18 s</span></li>
          </ol>
          <button className="wide" type="button">Assign slices to pads 1–4</button>
        </div>
        <div className="plain-panel">
          <h2>Pad assignment</h2>
          <div className="early-pads">
            {padKeys.map((key, index) => <button className={index < 4 ? 'loaded-basic' : ''} type="button" key={key}><b>PAD {String(index + 1).padStart(2, '0')}</b><span>{index < 4 ? `Slice ${index + 1}` : 'Empty'}</span><small>{key}</small></button>)}
          </div>
        </div>
      </section>
    </main>
  )
}

function SequencerProblemScene() {
  const active = new Set([0, 4, 8, 12])
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollerRef.current
    if (el) el.scrollLeft = 5.5 * 50
  }, [])

  return (
    <main className="prototype-shell phone-prototype">
      <ReconstructionLabel
        title="16-step sequencer"
        note="Functional source · 07c4d7a"
        showClassification={false}
      />
      <section className="plain-panel">
        <div className="row between">
          <button className="active-basic" type="button">Play</button>
          <label>BPM <input className="number-input" type="number" value="120" readOnly /></label>
        </div>
        <p>Pattern: PAD 01</p>
        <div
          className="squeezed-steps"
          ref={scrollerRef}
          aria-label="Sixteen steps wider than the screen, mid-scroll, with a visible horizontal scrollbar"
        >
          {Array.from({ length: 16 }, (_, index) => <button className={active.has(index) ? 'on' : ''} type="button" key={index}>{index + 1}</button>)}
        </div>
        <div className="fake-scrollbar" aria-hidden="true"><div className="fake-scrollbar-thumb" /></div>
      </section>
      <section className="plain-panel compact-pad-context">
        <h2>Selected pad</h2>
        <button className="loaded-basic" type="button">PAD 01 · kick.wav</button>
      </section>
    </main>
  )
}

function SystemScatteredScene() {
  return (
    <main className="prototype-shell phone-prototype">
      <ReconstructionLabel title="Before one system display" note="Composite based on pre-ac13738 layouts" />
      <section className="old-toolbar">
        <button type="button">Play</button>
        <button type="button">Stop</button>
        <label>BPM <input className="number-input" value="120" readOnly /></label>
      </section>
      <p className="floating-status">Audio ready</p>
      <section className="plain-panel">
        <h2>SEQ</h2>
        <div className="early-step-grid">
          {Array.from({ length: 8 }, (_, index) => <button className={index === 0 || index === 4 ? 'on' : ''} type="button" key={index}>{index + 1}</button>)}
        </div>
        <div className="inline-parameter">
          <label>Selected step velocity <output>100%</output></label>
          <input type="range" value="100" readOnly />
        </div>
      </section>
      <p className="floating-message">Pattern changed to A</p>
      <section className="plain-panel">
        <h2>Selected pad</h2>
        <p>kick.wav loaded on PAD 01</p>
        <label className="stacked">Pad volume <output>0.86</output><input type="range" value="86" readOnly /></label>
      </section>
      <p className="floating-error">Cannot play SONG: playlist is empty.</p>
    </main>
  )
}

function LibraryPadEarlyScene() {
  return (
    <main className="prototype-shell phone-prototype">
      <ReconstructionLabel
        title="Pad instrument"
        note="Functional source · e8d92f5"
        showClassification={false}
      />
      <section className="plain-panel">
        <label className="file-control">Assign WAV <input type="file" accept=".wav,audio/wav" /></label>
        <p className="file-name">kick-01.wav · 0.16 s</p>
        <div className="early-pads early-pads-16">
          {padKeys16.map((key, index) => (
            <button className={index === 0 ? 'loaded-basic' : ''} type="button" key={key}>
              <b>PAD {String(index + 1).padStart(2, '0')}</b>
              <span>{index === 0 ? 'kick-01.wav' : 'Empty'}</span>
              <small>{key}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="plain-panel compact-pad-context">
        <h2>Selected pad</h2>
        <p>PAD 01 · kick-01.wav</p>
        <label className="stacked">Volume <output>1.00</output><input type="range" value="100" readOnly /></label>
      </section>
    </main>
  )
}

function SongEarlyScene() {
  const filledSlots = new Set([1, 2, 3, 5, 6, 8])
  return (
    <main className="prototype-shell phone-prototype">
      <ReconstructionLabel
        title="Pattern playlist"
        note="Functional source · 3ab73a0"
        showClassification={false}
      />
      <section className="plain-panel">
        <div className="row between">
          <label>Start slot <input className="number-input" type="number" value="8" readOnly /></label>
          <button className="active-basic" type="button">Add clip</button>
        </div>
        <p className="lab-caption">Rows are patterns. Columns are time slots.</p>
        <div className="playlist-grid">
          <div className="playlist-row playlist-head">
            <span>Pattern</span>
            {Array.from({ length: 8 }, (_, index) => <span key={index}>{index + 1}</span>)}
          </div>
          <div className="playlist-row">
            <span>1A</span>
            {Array.from({ length: 8 }, (_, index) => (
              <span className={filledSlots.has(index + 1) ? 'clip-on' : ''} key={index}>
                {filledSlots.has(index + 1) ? '1A' : ''}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function MixEarlyScene() {
  return (
    <main className="prototype-shell phone-prototype">
      <ReconstructionLabel
        title="16 channel mixer"
        note="Functional source · dfbb888"
        showClassification={false}
      />
      <section className="plain-panel">
        <p className="lab-caption">Mute overrides solo.</p>
        <div className="mixer-channels">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="mixer-channel" key={index}>
              <div className="row between"><b>PAD {String(index + 1).padStart(2, '0')}</b><span>Empty</span></div>
              <label className="stacked">Vol <output>1.00</output><input type="range" value="100" readOnly /></label>
              <div className="row">
                <button type="button">Mute</button>
                <button type="button">Solo</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function SceneRouter() {
  const scene = (new URLSearchParams(window.location.search).get('scene') ?? 'chop-manual') as Scene
  if (scene === 'seq-problem') return <SequencerProblemScene />
  if (scene === 'system-scattered') return <SystemScatteredScene />
  if (scene === 'library-pad-early') return <LibraryPadEarlyScene />
  if (scene === 'song-early') return <SongEarlyScene />
  if (scene === 'mix-early') return <MixEarlyScene />
  return <ManualChopScene />
}

createRoot(document.getElementById('root')!).render(<StrictMode><SceneRouter /></StrictMode>)
