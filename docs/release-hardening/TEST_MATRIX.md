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
| Transport | Manual STOP, project switch, context interruption, and unmount use immediate paired stop; natural SONG end uses its stamped boundary | PASS — source wiring plus 4 audio-boundary tests |
| Timing | Deterministic recovery at 25/70/150/500/2000 ms lateness | PASS — 6 deterministic tests |
| Voices | Paired STOP invokes both owned voice cleanup paths idempotently | PASS — lifecycle tests/source audit |
| Routing | 100 project replacements retain only current routing resources | PASS — deterministic registry stress test |
| Assets | Same-ID replacement/removal clears reverse/runtime/waveform caches | PASS — source audit; browser memory pending |
| Worklet | Forced optional worklet failure is captured, retryable, and cannot poison core startup | PASS — 5 deterministic lifecycle tests plus AudioEngine wiring audit |
| Storage | Failed/blocked opens can recover; `versionchange` closes stale DB | PASS — 3 deterministic lifecycle tests |
| Autosave | Latest state wins; unchanged asset blobs are not rewritten | PASS — 5 deterministic strategy/revision tests |
| Quota | Quota errors remain dirty and do not replace a valid save | PASS — classified abort plus transactional/revision tests |
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

## AudioEngine torture matrix

| Scenario | Automatic evidence | Real listening/browser check |
| --- | --- | --- |
| 100 PLAY/STOP cycles | Paired/idempotent shutdown paths covered | Required in Chrome and Edge |
| Rapid repeated pad triggering | Cleanup ownership inspected | Required for clicks, latency, retained voices |
| High synth polyphony | Voice caps/stealing/cleanup inspected | Required for sound and CPU behavior |
| Reverse sample triggering | One-buffer-per-asset lifecycle inspected | Required while watching memory diagnostics |
| Repeated project open/close | 100-cycle routing registry test passes | Required with real IndexedDB/WAV projects |
| Repeated audio start/stop | Dispose paths inspected | Required with browser autoplay/context policy |
| Multiple FX active | Rack disposal included in project pruning | Required for feedback tails/clicks |
| Pump active | Transport timestamps remain audio-clock based | Required listening test |
| Long-running transport | Late-wake counters now available | Required long-session browser test |
