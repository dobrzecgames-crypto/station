import { useState } from 'react'
import type { MouseEvent } from 'react'
import { builtInLibrary, libraryCategories } from './builtInLibrary'
import type { LibrarySample } from './builtInLibrary'
import './library.css'

interface LibraryWorkspaceProps {
  audioReady: boolean
  busySampleId: string | null
  previewingSampleId: string | null
  onPreview: (sample: LibrarySample) => void
  onLoad: (sample: LibrarySample, padNumber: number) => void
}

export function LibraryWorkspace({ audioReady, busySampleId, previewingSampleId, onPreview, onLoad }: LibraryWorkspaceProps) {
  const [contextSample, setContextSample] = useState<LibrarySample | null>(null)
  const [targetPadNumber, setTargetPadNumber] = useState(1)
  const isBusy = busySampleId !== null || previewingSampleId !== null

  const openLoadMenu = (event: MouseEvent<HTMLElement>, sample: LibrarySample) => {
    event.preventDefault()
    setContextSample(sample)
  }

  return (
    <section className="library-workspace" aria-labelledby="library-title">
      <div className="sequencer-heading"><div><p className="eyebrow">LIBRARY</p><h2 id="library-title">DRUMS</h2></div><p className="mixer-summary">CLICK TO PREVIEW · RIGHT-CLICK TO LOAD</p></div>
      <p className="library-help">Click a sound to preview it. Right-click a sound, enter PAD 1–16, then load it into that pad.</p>
      <div className="library-browser">
        {libraryCategories.map((category) => <section className="library-category" key={category} aria-label={`${category} sounds`}>
          <p className="eyebrow">{category}S</p>
          {builtInLibrary.filter((sample) => sample.category === category).map((sample) => <article className="library-row" key={sample.id} onContextMenu={(event) => openLoadMenu(event, sample)}>
            <button className="library-preview-button" type="button" disabled={!audioReady || isBusy} onClick={() => onPreview(sample)}>
              <span aria-hidden="true">{previewingSampleId === sample.id ? '■' : '▶'}</span><strong>{sample.filename.replace('.wav', '')}</strong>
            </button>
            {contextSample?.id === sample.id && <div className="library-load-menu" role="dialog" aria-label={`Load ${sample.filename} to pad`}>
              <label>LOAD TO PAD <input aria-label="Pad number" type="number" min="1" max="16" value={targetPadNumber} onChange={(event) => setTargetPadNumber(Math.min(16, Math.max(1, Number(event.target.value))))} /></label>
              <button className="mixer-toggle" type="button" disabled={!audioReady || isBusy} onClick={() => { onLoad(sample, targetPadNumber); setContextSample(null) }}>LOAD</button>
              <button className="mixer-toggle" type="button" onClick={() => setContextSample(null)}>CLOSE</button>
            </div>}
          </article>)}
        </section>)}
      </div>
    </section>
  )
}
