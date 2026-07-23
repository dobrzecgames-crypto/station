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

  return (
    <section className="library-workspace" aria-labelledby="library-title">
      <div className="sequencer-heading"><div><p className="eyebrow">LIBRARY</p><h2 id="library-title">DRUMS</h2></div><p className="mixer-summary">PREVIEW, THEN LOAD TO THE SELECTED PAD</p></div>
      <p className="library-help">The target is PAD {String(selectedPadNumber).padStart(2, '0')}. Choose PADS to select a different destination, then return here to load a sound.</p>
      <div className="library-browser">
        {libraryCategories.map((category) => <section className="library-category" key={category} aria-label={`${category} sounds`}>
          <p className="eyebrow">{category}S</p>
          {builtInLibrary.filter((sample) => sample.category === category).map((sample) => <article className="library-row" key={sample.id}>
            <button className="library-preview-button" type="button" disabled={!audioReady || isBusy} onClick={() => onPreview(sample)}><span aria-hidden="true">{previewingSampleId === sample.id ? '■' : '▶'}</span><strong>{sample.filename.replace('.wav', '')}</strong></button>
            <button className="library-load-button" type="button" disabled={!audioReady || isBusy} onClick={() => onLoad(sample, selectedPadNumber)}>LOAD PAD {String(selectedPadNumber).padStart(2, '0')}</button>
          </article>)}
        </section>)}
      </div>
    </section>
  )
}
