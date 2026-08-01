import { useEffect, useState } from 'react'
import {
  completeTuneGravityBlindSession,
  createDefaultTuneGravityRatings,
  exportTuneGravityListeningTest,
  revealTuneGravityBlindMapping,
  saveTuneGravityBlindEvaluation,
  tuneGravityProblemFlags,
  tuneGravityRatingKeys,
} from '../audio/tuneGravity/index.ts'
import type {
  TuneGravityBlindLabel,
  TuneGravityBlindSession,
  TuneGravityListeningProblemFlag,
  TuneGravityRatingKey,
  TuneGravityRatings,
} from '../audio/tuneGravity/index.ts'

interface TuneGravityBlindTestPanelProps {
  session: TuneGravityBlindSession
  auditioningLabel: TuneGravityBlindLabel | null
  disabled: boolean
  onAudition: (label: TuneGravityBlindLabel) => void
  onStop: () => void
  onChange: (session: TuneGravityBlindSession) => void
}

const ratingLabels: Record<TuneGravityRatingKey, string> = {
  intonationImprovement: 'INTONATION IMPROVEMENT',
  timbreNaturalness: 'TIMBRE NATURALNESS',
  pitchStability: 'PITCH STABILITY',
  vibratoPreservation: 'VIBRATO PRESERVATION',
  consonantQuality: 'CONSONANT QUALITY',
  freedomFromGrainAndMetal: 'NO GRAIN / METALLIC',
  voiceIdentityPreservation: 'VOICE IDENTITY',
  beatReadiness: 'BEAT READINESS',
}

export function TuneGravityBlindTestPanel({ session, auditioningLabel, disabled, onAudition, onStop, onChange }: TuneGravityBlindTestPanelProps) {
  const [selectedLabel, setSelectedLabel] = useState<TuneGravityBlindLabel>(session.labels[0]!)
  const [ratings, setRatings] = useState<TuneGravityRatings>(() => createDefaultTuneGravityRatings())
  const [flags, setFlags] = useState<TuneGravityListeningProblemFlag[]>([])
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('Algorithms stay hidden until every variant has a saved evaluation.')

  useEffect(() => {
    const saved = session.evaluations[selectedLabel]
    setRatings(saved ? { ...saved.ratings } : createDefaultTuneGravityRatings())
    setFlags(saved ? [...saved.flags] : [])
    setNotes(saved?.notes ?? '')
  }, [selectedLabel, session])

  const saveEvaluation = () => {
    try {
      onChange(saveTuneGravityBlindEvaluation(session, selectedLabel, { ratings, flags, notes }))
      setMessage(`${selectedLabel} evaluation saved.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this evaluation.')
    }
  }

  const finish = () => {
    try {
      onChange(completeTuneGravityBlindSession(session))
      setMessage('Blind test complete. Variant mapping is now revealed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not complete the blind test.')
    }
  }

  const mapping = revealTuneGravityBlindMapping(session)
  const complete = mapping !== null
  const allRated = session.labels.every((label) => session.evaluations[label] !== undefined)

  return <section className="tune-blind-panel" aria-labelledby="tune-blind-title">
    <header>
      <div><p className="eyebrow">BLIND COMPARISON</p><h3 id="tune-blind-title">A / B / C / D</h3></div>
      <span>{Object.keys(session.evaluations).length}/{session.labels.length} RATED</span>
    </header>
    <p className="tune-blind-message" role="status">{message}</p>
    <div className="tune-blind-players">
      {session.labels.map((label) => <button key={label} className={auditioningLabel === label ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" disabled={disabled} onClick={() => { setSelectedLabel(label); onAudition(label) }}>▶ {label}</button>)}
      <button className="mixer-toggle" type="button" disabled={auditioningLabel === null} onClick={onStop}>■ STOP</button>
    </div>

    {!complete && <div className="tune-blind-form">
      <div className="tune-blind-selected">EVALUATING <strong>{selectedLabel}</strong></div>
      <div className="tune-blind-ratings">
        {tuneGravityRatingKeys.map((key) => <label key={key}><span>{ratingLabels[key]}</span><output>{ratings[key]}</output><input type="range" min="1" max="5" step="1" value={ratings[key]} disabled={disabled} onChange={(event) => setRatings({ ...ratings, [key]: Number(event.target.value) })} /></label>)}
      </div>
      <fieldset className="tune-blind-flags"><legend>PROBLEM FLAGS</legend>{tuneGravityProblemFlags.map((flag) => <label key={flag}><input type="checkbox" checked={flags.includes(flag)} disabled={disabled} onChange={() => setFlags(flags.includes(flag) ? flags.filter((candidate) => candidate !== flag) : [...flags, flag])} />{flag.toUpperCase().replaceAll('-', ' ')}</label>)}</fieldset>
      <label className="tune-blind-notes"><span>NOTES</span><textarea value={notes} disabled={disabled} rows={3} onChange={(event) => setNotes(event.target.value)} /></label>
      <div className="tune-blind-actions">
        <button className="transport-button" type="button" disabled={disabled} onClick={saveEvaluation}>SAVE {selectedLabel} RATING</button>
        <button className="mixer-toggle" type="button" disabled={disabled || !allRated} onClick={finish}>FINISH & REVEAL</button>
      </div>
    </div>}

    {mapping && <div className="tune-blind-reveal">
      <h4>REVEALED MAPPING</h4>
      <ul>{session.labels.map((label) => <li key={label}><strong>{label}</strong><span>{variantLabel(mapping[label])}</span></li>)}</ul>
      <button className="clear-button" type="button" onClick={() => downloadJson(exportTuneGravityListeningTest(session), `${session.anonymousSourceId}-BLIND-RESULT.json`)}>EXPORT BLIND RESULT JSON</button>
    </div>}
  </section>
}

function variantLabel(variant: string): string {
  if (variant === 'original') return 'ORIGINAL'
  if (variant === 'yin-td-psola') return 'YIN + TD-PSOLA'
  if (variant === 'yin-granular') return 'YIN + GRANULAR'
  if (variant === 'mpm-td-psola') return 'MPM + TD-PSOLA'
  return variant
}

function downloadJson(value: unknown, filename: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
