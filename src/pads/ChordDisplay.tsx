import { useEffect, useMemo, useRef } from 'react'
import type { ChordAssignment } from '../music/chords'
import { chordRootMidiNote, chordSuggestions, formatChordAssignment, formatMidiNoteName, resolveChordMidiNotes } from '../music/chords'
import { formatProjectKey } from '../music/scales'
import type { ProjectKey } from '../music/scales'
import type { PatternGroup } from '../patterns/patternTypes'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'
import { DisplayRange } from '../shell/displayControls'
import type { ChordPerformanceSettings } from '../music/chordPerformance'
import type { PadState } from './types'
import './chordDisplay.css'

interface ChordDisplayLauncherProps {
  group: PatternGroup
  pad: PadState
  assignment: ChordAssignment
  projectKey: ProjectKey
  onAssignmentChange: (assignment: ChordAssignment) => void
  onPerformanceChange: (settings: ChordPerformanceSettings) => void
}

const displayId = 'pad-smart-chord-editor'

export function ChordDisplayLauncher(props: ChordDisplayLauncherProps) {
  const { claim, release } = useSystemDisplay()
  const latestProps = useRef(props)
  latestProps.current = props
  const tenant = useMemo(() => chordTenant(
    props,
    (assignment) => latestProps.current.onAssignmentChange(assignment),
    (settings) => latestProps.current.onPerformanceChange(settings),
  ), [props.group, props.pad, props.assignment, props.projectKey])

  useEffect(() => {
    claim(tenant)
    return () => release(displayId)
  }, [claim, release, tenant])

  return null
}

function chordTenant(props: ChordDisplayLauncherProps, onAssignmentChange: (assignment: ChordAssignment) => void, onPerformanceChange: (settings: ChordPerformanceSettings) => void): DisplayTenant {
  const padIndex = props.group.bank.pads.findIndex((pad) => pad.id === props.pad.id)
  const rootMidi = chordRootMidiNote(props.group, props.pad, props.projectKey)
  const currentName = formatChordAssignment(props.group, props.pad, props.assignment, props.projectKey)
  const notes = resolveChordMidiNotes(props.group, props.pad, props.assignment, props.projectKey)
  const suggestions = chordSuggestions(props.group, props.pad, props.projectKey, props.assignment)
  return {
    id: displayId,
    label: `${props.pad.label} smart chord`,
    readout: `${props.pad.label} · ${currentName}`,
    panel: <div className="chord-display">
      <div className="chord-display-summary">
        <span>PAD {String(padIndex + 1).padStart(2, '0')} · ROOT {formatMidiNoteName(rootMidi)}</span>
        <strong>CURRENT: {currentName}</strong>
        <span>SCALE: {formatProjectKey(props.projectKey)}</span>
        <span>NOTES: {notes.map((note) => formatMidiNoteName(note).replace(/-?\d+$/, '')).join(' · ')}</span>
      </div>
      <div className="chord-suggestion-list" aria-label={`Chord choices for ${props.pad.label}`}>
        {suggestions.map((suggestion) => <button
          className={suggestion.type === props.assignment.type ? 'display-action chord-suggestion-active' : 'display-action'}
          type="button"
          key={suggestion.type}
          aria-pressed={suggestion.type === props.assignment.type}
          title={suggestion.noteNames.join(' · ')}
          onClick={() => onAssignmentChange({ type: suggestion.type })}
        >{suggestion.name}</button>)}
      </div>
      <div className="chord-performance" aria-label="Smart Chords performance">
        <span className="chord-performance-heading">PLAY</span>
        {(['strum', 'dynamics', 'humanize'] as const).map((parameter) => <DisplayRange
          key={parameter}
          idPrefix="smart-chords"
          label={parameter.toUpperCase()}
          min="0"
          max="100"
          step="1"
          current={props.group.chordPerformance[parameter]}
          formatValue={(value) => `${Math.round(value)}%`}
          onChange={(value) => onPerformanceChange({ ...props.group.chordPerformance, [parameter]: value })}
        />)}
      </div>
    </div>,
  }
}
