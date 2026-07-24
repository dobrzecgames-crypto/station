import { useState } from 'react'
import { builtInLibrary, libraryCategories } from './builtInLibrary'
import type { LibraryCategory, LibrarySample } from './builtInLibrary'
import type { PadState } from '../pads/types'
import './library.css'

interface LibraryWorkspaceProps {
  audioReady: boolean
  pads: readonly Pick<PadState, 'id' | 'fileName'>[]
  busySampleId: string | null
  previewingSampleId: string | null
  onPreview: (sample: LibrarySample) => void
  onLoad: (sample: LibrarySample, padNumber: number) => void
}

export function LibraryWorkspace({ audioReady, pads, busySampleId, previewingSampleId, onPreview, onLoad }: LibraryWorkspaceProps) {
  const isBusy = busySampleId !== null || previewingSampleId !== null
  const [openCategory, setOpenCategory] = useState<LibraryCategory | null>(null)
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null)
  const selectedSample = builtInLibrary.find((sample) => sample.id === selectedSampleId) ?? null

  const assignToPad = (padNumber: number) => {
    if (!selectedSample) return
    onLoad(selectedSample, padNumber)
    setSelectedSampleId(null)
  }

  return (
    <section className="library-workspace" aria-labelledby="library-title">
      <div className="sequencer-heading"><div><p className="eyebrow">LIBRARY</p><h2 id="library-title">SAMPLES</h2></div></div>
      <div className="library-browser">
        {libraryCategories.map((category) => {
          const isOpen = openCategory === category
          return (
            <section className="library-category" key={category} aria-label={`${category} sounds`}>
              <button className="library-category-toggle" type="button" aria-expanded={isOpen} onClick={() => setOpenCategory((current) => current === category ? null : category)}>
                <span className="eyebrow">{category}S</span>
                <span aria-hidden="true">{isOpen ? '▲' : '▾'}</span>
              </button>
              {isOpen && builtInLibrary.filter((sample) => sample.category === category).map((sample) => <article className="library-row" key={sample.id}>
                <button className="library-preview-button" type="button" disabled={!audioReady || isBusy} onClick={() => onPreview(sample)}><span aria-hidden="true">{previewingSampleId === sample.id ? '■' : '▶'}</span><strong>{sample.filename.replace('.wav', '')}</strong></button>
                <button className={selectedSampleId === sample.id ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" disabled={!audioReady || isBusy} aria-pressed={selectedSampleId === sample.id} onClick={() => setSelectedSampleId((current) => current === sample.id ? null : sample.id)}>{selectedSampleId === sample.id ? 'SELECTED' : 'SELECT'}</button>
              </article>)}
            </section>
          )
        })}
      </div>
      <div className="library-assign-panel">
        <p className="eyebrow">ASSIGN</p>
        {selectedSample && <p className="mixer-summary">TAP A PAD TO ASSIGN {selectedSample.filename}</p>}
        <div className="library-assign-grid" role="group" aria-label="Assign selected sample to a pad">
          {pads.map((pad, index) => (
            <button
              key={pad.id}
              type="button"
              className={pad.fileName ? 'library-assign-pad library-assign-pad-loaded' : 'library-assign-pad'}
              disabled={!audioReady || isBusy || !selectedSample}
              title={pad.fileName ?? 'Empty pad'}
              onClick={() => assignToPad(index + 1)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
