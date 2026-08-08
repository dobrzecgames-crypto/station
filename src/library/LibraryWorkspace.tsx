import { useEffect, useState } from 'react'
import { builtInLibrary, libraryCategories } from './builtInLibrary'
import type { LibrarySample } from './builtInLibrary'
import { useSystemDisplay } from '../shell/systemDisplayContext'
import './library.css'

interface LibraryWorkspaceProps {
  audioReady: boolean
  busySampleId: string | null
  previewingSampleId: string | null
  selectedSample: LibrarySample | null
  onPreview: (sample: LibrarySample) => void
  onSelectedSampleChange: (sample: LibrarySample | null) => void
}

const displayId = 'library-drop'

/** Source browser embedded under the real pad grid: select a sample, then tap its target pad. */
export function LibraryWorkspace({ audioReady, busySampleId, previewingSampleId, selectedSample, onPreview, onSelectedSampleChange }: LibraryWorkspaceProps) {
  const isBusy = busySampleId !== null || previewingSampleId !== null
  const [categoryIndex, setCategoryIndex] = useState(0)
  const category = libraryCategories[categoryIndex]
  const categorySamples = builtInLibrary.filter((sample) => sample.category === category)
  const { claim, release } = useSystemDisplay()

  useEffect(() => {
    if (selectedSample) claim({
      id: displayId,
      label: 'Drop sample to pad',
      readout: `DROP ${selectedSample.filename.replace('.wav', '')} / TAP A PAD`,
      panel: null,
    })
    else release(displayId)
  }, [selectedSample, claim, release])

  useEffect(() => () => release(displayId), [release])

  return <section className="library-workspace pad-library" aria-label="Library, select a sample then drop it on a pad">
    <div className="library-heading"><p className="eyebrow">LIBRARY</p><span>{selectedSample ? 'DROP TO PAD' : 'SELECT A SAMPLE'}</span></div>
    <div className="library-category-selector">
      <button className="mixer-toggle" type="button" aria-label="Previous category" disabled={categoryIndex <= 0} onClick={() => setCategoryIndex((index) => index - 1)}>PREV</button>
      <strong>{category === 'BREAKS' ? category : `${category}S`}</strong>
      <button className="mixer-toggle" type="button" aria-label="Next category" disabled={categoryIndex >= libraryCategories.length - 1} onClick={() => setCategoryIndex((index) => index + 1)}>NEXT</button>
    </div>
    <div className="library-browser">
      {categorySamples.map((sample) => <article className="library-row" key={sample.id}>
        <button className="library-preview-button" type="button" disabled={!audioReady || isBusy} onClick={() => onPreview(sample)}><span aria-hidden="true">{previewingSampleId === sample.id ? 'STOP' : 'PLAY'}</span><strong>{sample.filename.replace('.wav', '')}</strong></button>
        <button className={selectedSample?.id === sample.id ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" disabled={!audioReady || isBusy} aria-pressed={selectedSample?.id === sample.id} onClick={() => onSelectedSampleChange(selectedSample?.id === sample.id ? null : sample)}>{selectedSample?.id === sample.id ? 'READY TO DROP' : 'SELECT'}</button>
      </article>)}
    </div>
  </section>
}
