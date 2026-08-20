# Release Hardening Test Matrix

## Release-browser priority

| Tier | Browser | Release role |
| --- | --- | --- |
| Tier 1 | iOS Safari | RELEASE BLOCKING — physical-device acceptance required |
| Tier 1 | Android Chrome | RELEASE BLOCKING — physical-device acceptance required |
| Tier 2 | Desktop Chrome | Supporting compatibility target |
| Tier 3 | Microsoft Edge and other browsers | Best effort; missing coverage is not a release NO-GO |

Mobile viewport/touch emulation is a preflight layer only. It can find layout,
Pointer Events, gesture, scroll, persistence, render, and lifecycle defects,
but it cannot pass either Tier 1 physical-device row.

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
| Render | Event planning for bounded SONG + TRACKS material and FX tails | PASS — 2 deterministic render-plan tests plus a real non-silent OfflineAudioContext WAV in Chrome and Edge |
| Crash | Forced React render failure shows truthful recovery UI with view/copy diagnostics | PASS — 2 unit tests plus local Chromium DOM/control verification |
| Diagnostics | Hidden-by-default 1 Hz runtime state with 30 s storage refresh and build SHA | PASS — 2 unit tests plus local Chromium opt-in/default-state verification |
| Browser | Startup, real audio gesture, Chop/pad WAV load, SONG render, 10× play/stop, save, reload, reopen/restore | PASS — legacy desktop Playwright evidence in Chrome and Edge on Windows; supports Tier 2/Tier 3 only, audible output not claimed |
| CI | Frozen install, logic tests, typecheck, production build, pinned Chromium smoke | CONFIGURED — local equivalents pass; first hosted run pending because branch is not pushed |

## MOBILE RC automatic and emulated preflight

The detailed execution record belongs in `MOBILE_RC_QA.md`. The preflight must
cover both iPhone-like and Android-like portrait and landscape viewports with
touch enabled, including:

- Pointer Events and `pointercancel` cleanup;
- computed `touch-action` on gesture-critical surfaces;
- slider dragging and rapid pad tapping;
- multitouch where the tooling can dispatch independent touch points;
- PLAY/STOP and synth controls;
- TRACKS gestures and scrolling-conflict checks;
- save/reload, offline render, and error/console inspection;
- background/foreground and AudioContext suspend/resume simulation;
- orientation changes without reloading the application.

Every result must state whether it is deterministic automation, desktop-engine
mobile emulation, or a physical-device observation. Emulation is never recorded
as an iOS Safari or Android Chrome pass.

Execution result: **PASS** — 6 passed and 2 intentionally skipped duplicate
landscape workflows. See `MOBILE_RC_QA.md`. Physical Tier 1 rows remain open.

## Browser smoke commands

Playwright's pinned Chromium is the portable/CI target:

```text
pnpm exec playwright install chromium
pnpm test:browser
```

Installed Windows channels can run the identical supporting desktop spec with:

```text
pnpm test:browser:chrome
pnpm test:browser:edge
```

For a local Chromium-family executable without a Playwright download, set
`STATION_CHROMIUM_EXECUTABLE` to its absolute path before `pnpm test:browser`.

## Requires physical Tier 1 devices

These checks cannot be claimed from unit/headless tests alone:

- Clicks/glitches during rapid samples, synth polyphony, STOP, and FX changes.
- Pump musical behavior and retrigger sound.
- iOS Safari and Android Chrome autoplay/user-gesture behavior with actual output.
- AudioContext suspend/interruption recovery after app switch, screen lock,
  background/foreground, output-route change, and headphone disconnect/reconnect.
- Long-session audible timing and render/live A/B comparison.
- Real WAV import and playback by touch in both Tier 1 browsers.
- Portrait/landscape transitions, safe-area behavior, scrolling conflicts,
  multitouch, rapid pad tapping, slider dragging, and TRACKS gestures on real
  capacitive touch hardware.

Results are recorded here as the pass progresses; unchecked manual items remain
unverified rather than implicitly passing.

## AudioEngine torture matrix

| Scenario | Automatic evidence | Real listening/browser check |
| --- | --- | --- |
| 100 PLAY/STOP cycles | Paired/idempotent shutdown paths covered | Required on both Tier 1 devices; desktop Chrome is supporting evidence |
| Rapid repeated pad triggering | Cleanup ownership inspected | Required for clicks, latency, retained voices |
| High synth polyphony | Voice caps/stealing/cleanup inspected | Required for sound and CPU behavior |
| Reverse sample triggering | One-buffer-per-asset lifecycle inspected | Required while watching memory diagnostics |
| Repeated project open/close | 100-cycle routing registry test passes | Required with real IndexedDB/WAV projects |
| Repeated audio start/stop | Dispose paths inspected | Required with browser autoplay/context policy |
| Multiple FX active | Rack disposal included in project pruning | Required for feedback tails/clicks |
| Pump active | Transport timestamps remain audio-clock based | Required listening test |
| Long-running transport | Late-wake counters now available | Required long-session browser test |

Edge remains useful best-effort evidence, but no Edge-only gap can block the
mobile-first release decision.
