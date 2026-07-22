# Station MVP Scope

## Purpose

The MVP must prove that Station works as a browser instrument, not merely as a visual prototype.

It must prove four things:

1. Pads respond well enough to play on desktop and mobile browsers.
2. A 16-step pattern plays with stable audio scheduling.
3. Basic Pump creates a useful musical result without compressor-style setup.
4. A project can be saved locally and reopened.

## Included in the MVP

### Platform

- Browser application built with TypeScript, React and Vite.
- Desktop browser support as the primary development environment.
- Real iPhone Safari and Android Chrome testing from the first audio milestone.
- AudioContext initialization only after an intentional user interaction.

### Pads and samples

- One bank of 16 pads in a 4 x 4 layout.
- WAV import for each pad.
- One-shot playback.
- Repeated triggering of the same sample.
- Multitouch pad input.
- Mouse and keyboard input on desktop.
- Volume per pad.
- Pitch per pad expressed in semitones.
- Pitch changes playback speed and duration; no time-stretching.
- Basic visual feedback for pad triggers.

### Sequencer

- One pattern only.
- 16 steps.
- One track per pad.
- BPM control.
- Play and stop.
- Step activation and deactivation.
- Simple velocity support, preferably a small number of useful levels.
- Editing while playback continues.
- Audio scheduling based on AudioContext time, not UI timers.

### Basic Pump

- One user-selected kick pad as the trigger source.
- Pump can be enabled on selected target tracks.
- Full-band gain shaping only.
- DEPTH control.
- Tempo-synced LENGTH control.
- SNAP, SMOOTH and SWELL curve profiles.
- Musical retrigger behavior when another kick occurs.
- No automatic kick-length analysis.

### Persistence

- Local project save.
- Local storage of imported sample data or managed local copies.
- Saved pad parameters, pattern steps, BPM and Pump settings.
- Ability to reopen the last saved project.
- Project schema version field from the first persisted format.
- Clear failure behavior for unavailable, corrupt or unsupported data.

### Interface

- Intentional start/init screen.
- Pad view.
- Sequencer view.
- Minimal pad parameter editor.
- Minimal Pump controls.
- Responsive touch-first layout.
- Basic Station visual identity without expensive decorative systems.

## Explicitly excluded from the MVP

- Multiple banks.
- Multiple patterns.
- Scenes or song arrangement.
- Waveform editing.
- Start/end editing.
- Chop and slicing.
- Resampling.
- Reverse, loop and gate modes.
- Swing and microtiming.
- Per-track pattern lengths and polymeter.
- Probability, ratchets and step conditions.
- Parameter locks or per-step automation.
- Automatic kick analysis.
- LOW or SPLIT Pump modes.
- Ghost Pump triggers.
- MIDI support.
- Microphone recording.
- MP3, FLAC and AIFF as guaranteed import formats.
- Cloud storage, accounts or sharing.
- PWA installation requirements.
- Capacitor packaging.
- Native or JUCE versions.

## Definition of done

The MVP is complete only when all of the following are true:

- A new user can import several WAV files and play them on 16 pads.
- Multiple touches can trigger separate pads without the page scrolling or selecting text.
- The pattern plays consistently during normal UI interaction.
- The UI playhead may drift visually by a small amount, but audio timing must remain authoritative and stable.
- Basic Pump is clearly audible, controllable and musically useful on at least bass and pad material.
- Closing and reopening the browser does not destroy a correctly saved project.
- The core workflow has been manually tested on Windows Chromium, iPhone Safari and Android Chrome.
- Known limitations are documented.
- No excluded feature has been smuggled into the MVP at the expense of stability.