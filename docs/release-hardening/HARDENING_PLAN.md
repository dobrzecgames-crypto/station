# Station Release Hardening Plan

## Scope

Branch: `release/station-hardening`

Starting commit: `0d99b79df89634e5b3c8b5a8a5471b2ee941f750`

This pass is a feature freeze. Work is limited to correctness, reliability,
recoverability, testability, diagnostics, release safety, persistence safety,
timing stability, and browser lifecycle handling.

## Order of work

1. Establish and record the untouched baseline.
2. Audit and harden transport/audio lifecycle.
3. Make scheduler stall recovery explicit and deterministic.
4. Audit active-voice, cache, FX, Pump, and AudioWorklet lifecycles.
5. Isolate optional ZOLA-X/AudioWorklet failure from core audio startup.
6. Harden IndexedDB connection and project-save lifecycles.
7. Avoid rewriting unchanged WAV assets during autosave; preserve save ordering.
8. Surface quota/storage pressure and save-state failures.
9. Define and verify offline render parity, including TRACKS.
10. Add fatal React recovery and lightweight internal diagnostics.
11. Add behavior-focused Chromium/Edge smoke coverage and a CI validation gate.
12. Perform a release-candidate code review and final validation.

P0 findings take priority over P1. P2 cleanup is deferred while any P0/P1
finding remains open.

## Validation gate

Every completed stage must pass:

```text
pnpm test
pnpm typecheck
pnpm build
```

Browser stages also run the release smoke suite. Real audio quality, device
interruption, sleep/wake, and output-device changes remain explicit listening
checks; headless automation is not evidence for those claims.

## Commit boundaries

Commits are stage-sized and auditable. No merge, push, deployment, Vercel
change, or domain change is part of this pass.
