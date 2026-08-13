import './SynthPicker.css'

export type SynthPickerInstrument = 'monopoly' | 'organicbass' | 'strings' | 'poly' | 'drumsynth'

interface SynthPickerProps {
  onSelect: (instrument: SynthPickerInstrument) => void
}

const instruments: ReadonlyArray<{ id: SynthPickerInstrument; name: string; description: string }> = [
  { id: 'monopoly', name: 'BASSIC', description: 'Monophonic bass, leads and short synth sounds.' },
  { id: 'organicbass', name: 'MONOGORG', description: 'Dark, rounded mono bass for sampled beats.' },
  { id: 'strings', name: 'STRINGS', description: 'Polyphonic strings, pads and analog brass.' },
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

function SynthGlyph({ variant, className }: { variant: SynthPickerInstrument; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 68" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1.5" y="1.5" width="97" height="65" rx="6" stroke="currentColor" strokeWidth="2" />
      <line x1="1.5" y1="30" x2="98.5" y2="30" stroke="currentColor" strokeWidth="2" />

      {variant === 'organicbass' ? (
        <>
          <path d="M9 19 C13 7 18 7 22 19 C26 27 30 25 34 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <line x1="9" y1="23" x2="34" y2="23" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : variant === 'monopoly' ? (
        <>
          <rect x="9" y="8" width="22" height="9" rx="1.3" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="21.5" r="1.5" fill="currentColor" />
          <circle cx="17" cy="21.5" r="1.5" fill="currentColor" />
          <circle cx="22" cy="21.5" r="1.5" fill="currentColor" />
          <circle cx="27" cy="21.5" r="1.5" fill="currentColor" />
        </>
      ) : variant === 'strings' ? (
        <>
          <polyline points="9,15 13,9 17,20 21,10 25,17 29,14 33,14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="9" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : variant === 'poly' ? (
        <>
          <path d="M9 20 C12 8 15 8 18 20 C21 28 24 7 27 15 C30 23 32 12 34 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M9 24 C14 19 19 26 24 19 C29 13 32 19 34 17" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".65" />
        </>
      ) : (
        // A percussive attack/decay envelope - a sharp spike settling back to
        // baseline, standing in for the same "what does this instrument do"
        // read the other two glyphs give at a glance.
        <polyline points="9,22 12,9 15,22 18,17 21,20.5 25,21.5 29,22 33,22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      )}

      {knobCenters.map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="15" r="6.5" stroke="currentColor" strokeWidth="1.6" />
          <line x1={cx} y1="15" x2={cx} y2="9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      ))}

      {whiteKeyDividers.map((x) => (
        <line key={x} x1={x} y1="30" x2={x} y2="66.5" stroke="currentColor" strokeWidth="1.2" />
      ))}
      {blackKeys.map((x) => (
        <rect key={x} x={x - 3.25} y="30" width="6.5" height="20" fill="currentColor" />
      ))}
    </svg>
  )
}
