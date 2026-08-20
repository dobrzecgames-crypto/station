# Station Release Hardening Plan

## Scope

Branch: `release/station-hardening`

Starting commit: `0d99b79df89634e5b3c8b5a8a5471b2ee941f750`

This pass is a feature freeze. Work is limited to correctness, reliability,
recoverability, testability, diagnostics, release safety, persistence safety,
timing stability, and browser lifecycle handling.

## Mobile-first release target

Product-owner decision recorded on 2026-08-20:

- **Tier 1 / release blocking:** iOS Safari and Android Chrome.
- **Tier 2:** desktop Chrome.
- **Tier 3 / best effort:** Microsoft Edge and all other browsers.

A missing or incomplete Edge matrix is not a release NO-GO. Automated mobile
emulation is required as early evidence, but it never substitutes for the
physical iPhone Safari and Android Chrome acceptance passes.

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
11. Add behavior-focused browser smoke coverage, mobile viewport/touch
    emulation, and a CI validation gate. Preserve desktop Chromium/Edge results
    as supporting evidence rather than treating Edge as release blocking.
12. Perform a release-candidate code review and final validation.
13. Complete physical Tier 1 RC acceptance on iPhone Safari and Android Chrome.

P0 findings take priority over P1. P2 cleanup is deferred while any P0/P1
finding remains open.

## Validation gate

Every completed stage must pass:

```text
pnpm test
pnpm typecheck
pnpm build
```

Browser stages also run the release smoke suite and the maximum practical
mobile emulation matrix. Real touch hardware, mobile Safari/Chrome engine
behavior, audio quality, device interruption, lock/background transitions,
orientation changes, and output-route changes remain explicit physical-device
checks; headless or desktop-device emulation is not evidence for those claims.

## Commit boundaries

Commits are stage-sized and auditable. No merge, push, deployment, Vercel
change, or domain change is part of this pass.
