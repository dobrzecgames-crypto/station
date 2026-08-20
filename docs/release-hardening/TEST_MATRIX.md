# Release Hardening Test Matrix

## Automatically verified baseline

| Area | Check | Chrome engine required | Result |
| --- | --- | --- | --- |
| Logic | Node test suite | No | PASS — 110/110 |
| Types | TypeScript project build | No | PASS |
| Bundle | Vite production build | No | PASS with chunk-size warning |

## Automated coverage to add

| Area | Required proof | Status |
| --- | --- | --- |
| Transport | Shared start timestamp; idempotent paired stop; partial-start repair/rollback | PASS — 4 deterministic tests |
| Transport | Manual STOP, SONG completion, project switch, context interruption, unmount all use paired boundary | PASS — source-wiring audit |
| Timing | Deterministic recovery at 25/70/150/500/2000 ms lateness | PASS — 6 deterministic tests |
| Voices | Repeated lifecycle cycles return owned voice counts to zero | Pending |
| Worklet | Forced optional worklet failure preserves core audio startup | Pending |
| Storage | Failed/blocked opens can recover; `versionchange` closes stale DB | Pending |
| Autosave | Latest state wins; unchanged asset blobs are not rewritten | Pending |
| Quota | Quota errors remain dirty and do not replace a valid save | Pending |
| Render | Event/waveform parity for supported SONG and TRACKS material | Pending |
| Crash | Forced React render failure shows recovery UI | Pending |
| Browser | Startup, audio gesture, play/stop, save, reload, reopen | Pending |

## Requires real listening or device behavior

These checks cannot be claimed from unit/headless tests alone:

- Clicks/glitches during rapid samples, synth polyphony, STOP, and FX changes.
- Pump musical behavior and retrigger sound.
- Chrome and Edge autoplay/user-gesture behavior with actual output.
- AudioContext suspend/interruption recovery after alt-tab, minimize, sleep/wake,
  output-device change, and headphone disconnect/reconnect.
- Long-session audible timing and render/live A/B comparison.
- Real WAV import and playback by mouse and keyboard in both target browsers.

Results are recorded here as the pass progresses; unchecked manual items remain
unverified rather than implicitly passing.
