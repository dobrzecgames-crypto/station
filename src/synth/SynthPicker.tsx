import './SynthPicker.css'

export type SynthPickerInstrument = 'monopoly' | 'organicbass' | 'strings' | 'poly' | 'drumsynth'

interface SynthPickerProps {
  onSelect: (instrument: SynthPickerInstrument) => void
}

/* STRINGS is paused, not removed: taken out of this list only, so it can no
   longer be picked for a new pattern. Everything else stays wired - the
   'strings' branch of SynthPickerInstrument, every function keyed on it in
   App.tsx, StringsWorkspace/StringsDisplay, stringsOperations, its own
   preset library and its own tests. Any pad created before this pause keeps
   opening its full STRINGS editor exactly as before; this only blocks
   *creating new* STRINGS pads. To bring it back, restore the entry below
   (kept here for the exact copy) - nothing else needs to change. */
// { id: 'strings', name: 'STRINGS', description: 'Polyphonic strings, pads and analog brass.' },
const instruments: ReadonlyArray<{ id: SynthPickerInstrument; name: string; description: string }> = [
  { id: 'monopoly', name: 'BASSIC', description: 'Monophonic bass, leads and short synth sounds.' },
  { id: 'organicbass', name: 'MONOGORG', description: 'Dark, rounded mono bass for sampled beats.' },
  { id: 'poly', name: 'ZOLA-X', description: 'Modern polyphonic wavetable synthesizer.' },
  { id: 'drumsynth', name: 'DRUM SYNTH', description: 'Synthesized kicks for electronic drum patterns.' },
]

export function SynthPicker({ onSelect }: SynthPickerProps) {
  return (
    <section className="synth-picker" aria-label="Choose a synthesizer">
      <p className="eyebrow">SYNTH</p>
      <h2 className="synth-picker-heading">Choose an instrument</h2>
      <div className="synth-picker-list">
        {instruments.map((instrument) => (
          <button
            key={instrument.id}
            type="button"
            className={`synth-picker-card synth-picker-card-${instrument.id}`}
            onClick={() => onSelect(instrument.id)}
          >
            <SynthGlyph variant={instrument.id} className="synth-picker-card-icon" />
            <span className="synth-picker-card-text">
              <span className="synth-picker-card-name">{instrument.name}</span>
              <span className="synth-picker-card-description">{instrument.description}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

const whiteKeyDividers = [15.36, 29.21, 43.07, 56.93, 70.79, 84.64]
const blackKeys = [15.36, 29.21, 56.93, 70.79, 84.64]
const knobCenters = [49, 63, 77, 91]
const drumPadColors = [
  'var(--synth-glyph-primary)',
  'var(--synth-glyph-secondary)',
  'var(--synth-glyph-tertiary)',
  'var(--synth-glyph-quaternary)',
]

function SynthGlyph({ variant, className }: { variant: SynthPickerInstrument; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 68" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round">
      {variant === 'monopoly' ? (
        <>
          <rect x="10" y="4" width="80" height="60" rx="10" fill="var(--synth-glyph-surface)" />
          <rect x="10" y="4" width="80" height="60" rx="10" stroke="currentColor" strokeWidth="1.5" opacity=".62" />
          {[19, 34, 49].map((cy) => (
            <g key={cy}>
              <circle cx="21" cy={cy} r="2.5" fill="var(--synth-glyph-secondary)" />
              <path d={`M26 ${cy} C29 ${cy - 4} 32 ${cy + 4} 36 ${cy}`} stroke="var(--synth-glyph-secondary)" strokeWidth="1.8" />
            </g>
          ))}
          <text x="62" y="55" fill="currentColor" fontFamily="Inter, sans-serif" fontSize="52" fontWeight="800" textAnchor="middle" stroke="none">3</text>
        </>
      ) : variant === 'organicbass' ? (
        <g transform="matrix(1 0 0 1.16 0 -5.12)">
          <path d="M7 57 V11 Q7 7 11 7 H80 L93 19 V57 Z" fill="var(--synth-glyph-surface)" />
          <path d="M7 57 V11 Q7 7 11 7 H80 L93 19 V57 Z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M7 12 H13 V57 H7 Z" fill="var(--synth-glyph-secondary)" opacity=".78" stroke="none" />
          <path d="M80 7 V19 H93 Z" fill="var(--synth-glyph-secondary)" opacity=".58" stroke="none" />
          <path d="M80 7 V19 H93" stroke="var(--synth-glyph-secondary)" strokeWidth="1.4" />
          <text x="17" y="19" fill="var(--synth-glyph-tertiary)" fontFamily="Inter, sans-serif" fontSize="7" fontWeight="800" letterSpacing="1" stroke="none">GORG</text>
          {[51, 60, 69].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="16" r="3.4" fill="var(--station-recess)" stroke="var(--synth-glyph-quaternary)" strokeWidth="1.25" />
              <line x1={cx} y1="16" x2={cx + 1.3} y2="13.7" stroke="var(--synth-glyph-quaternary)" strokeWidth="1.1" />
            </g>
          ))}
          <rect x="73" y="23" width="17" height="14" rx="1.5" fill="var(--station-recess)" stroke="currentColor" strokeWidth="1" opacity=".9" />
          {[26, 32].flatMap((cy) => [77, 83, 89].map((cx) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.25" fill="var(--synth-glyph-tertiary)" />
          )))}
          <circle cx="77" cy="26" r="1.7" fill="var(--synth-glyph-secondary)" stroke="var(--station-recess)" strokeWidth=".7" />
          <circle cx="89" cy="32" r="1.7" fill="var(--synth-glyph-secondary)" stroke="var(--station-recess)" strokeWidth=".7" />
          <path d="M77 26 C71 28 72 36 79 35 C84 34 84 29 89 32" stroke="var(--synth-glyph-secondary)" strokeWidth="1.7" />
          <rect x="13" y="39" width="59" height="18" fill="var(--station-text)" opacity=".78" stroke="none" />
          <line x1="13" y1="39" x2="93" y2="39" stroke="currentColor" strokeWidth="1.4" />
          {[22.83, 32.67, 42.5, 52.33, 62.17].map((x) => (
            <line key={x} x1={x} y1="39" x2={x} y2="57" stroke="var(--station-recess)" strokeWidth="1.1" opacity=".9" />
          ))}
          {[22.83, 32.67, 52.33, 62.17].map((x) => (
            <rect key={x} x={x - 2.7} y="39" width="5.4" height="10" fill="var(--station-recess)" />
          ))}
        </g>
      ) : variant === 'strings' ? (
        <g transform="matrix(.88 0 0 .9 6 3.4)">
          <rect x="1.5" y="1.5" width="97" height="65" rx="6" fill="var(--synth-glyph-surface)" />
          <rect x="1.5" y="1.5" width="97" height="65" rx="6" stroke="currentColor" strokeWidth="2" />
          <line x1="1.5" y1="30" x2="98.5" y2="30" stroke="currentColor" strokeWidth="2" />
          <polyline points="9,15 13,9 17,20 21,10 25,17 29,14 33,14" stroke="var(--synth-glyph-secondary)" strokeWidth="1.8" />
          <line x1="9" y1="23" x2="16" y2="23" stroke="var(--synth-glyph-secondary)" strokeWidth="1.6" />
          {knobCenters.map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="15" r="6.5" fill="var(--station-recess)" stroke="currentColor" strokeWidth="1.6" />
              <line x1={cx} y1="15" x2={cx} y2="9.5" stroke="var(--synth-glyph-tertiary)" strokeWidth="1.6" />
            </g>
          ))}
          <rect x="1.5" y="30" width="97" height="36.5" fill="var(--station-text)" opacity=".76" stroke="none" />
          {whiteKeyDividers.map((x) => (
            <line key={x} x1={x} y1="30" x2={x} y2="66.5" stroke="var(--station-recess)" strokeWidth="1.2" />
          ))}
          {blackKeys.map((x) => (
            <rect key={x} x={x - 3.25} y="30" width="6.5" height="20" fill="var(--station-recess)" />
          ))}
        </g>
      ) : variant === 'poly' ? (
        <g transform="matrix(1.13 0 0 1.18 -6.5 -6.03)">
          <path d="M11 57 L27 10 H89 L73 57 Z" fill="var(--synth-glyph-surface)" />
          <path d="M11 57 L27 10 H89 L73 57 Z" stroke="currentColor" strokeWidth="1.65" opacity=".9" />
          <path d="M15 51 C22 42 27 56 35 48 C42 41 47 56 55 47 C61 40 67 52 76 45" stroke="currentColor" strokeWidth="2" />
          <path d="M18 43 C25 34 30 48 38 40 C45 32 49 47 58 38 C64 31 70 43 79 36" stroke="var(--synth-glyph-secondary)" strokeWidth="1.9" />
          <path d="M21 35 C28 27 34 39 41 31 C48 23 53 38 61 29 C68 22 73 34 82 27" stroke="var(--synth-glyph-tertiary)" strokeWidth="1.75" />
          <path d="M24 27 C31 20 36 30 44 23 C51 16 56 28 64 20 C70 15 76 25 85 19" stroke="var(--synth-glyph-quaternary)" strokeWidth="1.55" />
          {[27, 42, 57, 72].map((x, index) => (
            <line key={x} x1={x - index * 4} y1={10 + index * 12} x2={11 + index * 16} y2="57" stroke="var(--synth-glyph-tertiary)" strokeWidth=".9" opacity=".3" />
          ))}
        </g>
      ) : (
        <g transform="matrix(1.15 0 0 1 -7.5 0)">
          <rect x="14" y="4" width="72" height="60" rx="7" fill="var(--synth-glyph-surface)" />
          <rect x="14" y="4" width="72" height="60" rx="7" stroke="currentColor" strokeWidth="1.7" />
          {[[20, 10], [52, 10], [20, 37], [52, 37]].map(([x, y], index) => (
            <g key={`${x}-${y}`}>
              <rect x={x} y={y} width="28" height="21" rx="4" fill={drumPadColors[index]} opacity=".72" />
              <rect x={x} y={y} width="28" height="21" rx="4" stroke={drumPadColors[index]} strokeWidth="1.55" />
              <rect x={x + 3} y={y + 3} width="22" height="15" rx="2.5" stroke="var(--station-text)" strokeWidth=".8" opacity=".2" />
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}
