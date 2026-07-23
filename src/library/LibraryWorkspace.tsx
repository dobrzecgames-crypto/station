import { useEffect, useState } from 'react'
import { builtInLibrary, libraryCategories } from './builtInLibrary'
import type { LibrarySample } from './builtInLibrary'
import './library.css'

interface LibraryWorkspaceProps {
  audioReady: boolean
  selectedPadNumber: number
  busySampleId: string | null
  previewingSampleId: string | null
  onPreview: (sample: LibrarySample) => void
  onLoad: (sample: LibrarySample, padNumber: number) => void
}

export function LibraryWorkspace({ audioReady, selectedPadNumber, busySampleId, previewingSampleId, onPreview, onLoad }: LibraryWorkspaceProps) {
  const isBusy = busySampleId !== null || previewingSampleId !== null
  const [targetPadText, setTargetPadText] = useState(String(selectedPadNumber))
  const targetPadNumber = /^\d+$/.test(targetPadText) ? Number(targetPadText) : null
  const targetPadValid = targetPadNumber !== null && targetPadNumber >= 1 && targetPadNumber <= 16

  useEffect(() => setTargetPadText(String(selectedPadNumber)), [selectedPadNumber])

  const normalizeTargetPad = () => {
    if (targetPadValid) setTargetPadText(String(targetPadNumber))
  }

  return (
    <section className="library-workspace" aria-labelledby="library-title">
      <div className="sequencer-heading"><div><p className="eyebrow">LIBRARY</p><h2 id="library-title">SAMPLES</h2></div><p className="mixer-summary">PREVIEW, THEN LOAD TO THE SELECTED PAD</p></div>
      <div className="library-target-control"><label htmlFor="library-target-pad">LOAD TO PAD <input id="library-target-pad" type="text" inputMode="numeric" pattern="[0-9]*" value={targetPadText} onChange={(event) => setTargetPadText(event.target.value.replace(/\D/g, ''))} onBlur={normalizeTargetPad} aria-describedby="library-target-help" /></label><p id="library-target-help">Pick a pad from 1–16. Selecting one in PADS fills this in automatically, but you can type a different number here.</p></div>
      <div className="library-browser">
        {libraryCategories.map((category) => <section className="library-category" key={category} aria-label={`${category} sounds`}>
          <p className="eyebrow">{category}S</p>
          {builtInLibrary.filter((sample) => sample.category === category).map((sample) => <article className="library-row" key={sample.id}>
            <button className="library-preview-button" type="button" disabled={!audioReady || isBusy} onClick={() => onPreview(sample)}><span aria-hidden="true">{previewingSampleId === sample.id ? '■' : '▶'}</span><strong>{sample.filename.replace('.wav', '')}</strong></button>
            <button className="library-load-button" type="button" disabled={!audioReady || isBusy || !targetPadValid} onClick={() => onLoad(sample, targetPadNumber!)}>LOAD TO PAD</button>
          </article>)}
        </section>)}
      </div>
    </section>
  )
}
