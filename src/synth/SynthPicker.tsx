import './SynthPicker.css'

export type SynthPickerInstrument = 'monopoly' | 'strings'

interface SynthPickerProps {
  onSelect: (instrument: SynthPickerInstrument) => void
}

const instruments: ReadonlyArray<{ id: SynthPickerInstrument; name: string; description: string }> = [
  { id: 'monopoly', name: 'MONOPOLY', description: 'Monophonic bass, leads and short synth sounds.' },
  { id: 'strings', name: 'STRINGS', description: 'Polyphonic strings, pads and analog brass.' },
]

export function SynthPicker({ onSelect }: SynthPickerProps) {
  return (
    <section className="synth-picker" aria-label="Choose a synthesizer">
      <p className="eyebrow">SYNTH</p>
      <h2 className="synth-picker-heading">Choose an instrument</h2>
      <div className="synth-picker-grid">
        {instruments.map((instrument) => (
          <button key={instrument.id} type="button" className="synth-picker-card" onClick={() => onSelect(instrument.id)}>
            <span className="synth-picker-card-name">{instrument.name}</span>
            <span className="synth-picker-card-description">{instrument.description}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
