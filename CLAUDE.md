# Station handoff for Claude

Read and follow `AGENTS.md` first. It is the source of truth for repository workflow, product scope, UI rules and required completion reports.

## Repository state

- Canonical checkout: `C:\Users\T470\Documents\station`
- Work directly on local `main`; do not create a branch or worktree unless Damian explicitly asks.
- Pattern-recording implementation commit: `f14304c` (`feat: improve pattern recording workflow`).
- That commit is pushed to `origin/main` and deployed to production on Vercel.
- Production alias: `https://gorgowebsky.com`

Always begin with:

```powershell
git status
git branch --show-current
git pull --ff-only
```

## Pattern recording behavior now implemented

- REC is a latched transport state with the existing four-click count-in from stop and immediate punch-in during playback.
- OVERDUB preserves existing events and adds recorded hits.
- REPLACE rebuilds from the take-start snapshot and replaces only the chronological range between the first and last recorded hit. It does not clear the whole pattern on REC.
- One REC-on to REC-off/STOP interval is one TAKE.
- TAKE UNDO restores the exact pre-take sequence, including events removed by REPLACE. REDO reapplies the take.
- Empty or cancelled takes create no history entry and do not extend the pattern.
- A first take on an empty pattern may auto-extend in complete sections: A=16, A+B=32, A+B+C=48, A+B+C+D=64.
- After D, recording loops to A without stopping.
- An established 16/32/48/64-step pattern keeps its current length and loops there; ordinary REC does not extend it.
- Audio timing remains in `StepSequencer` and is stamped from the Web Audio clock. React only edits/project-displays state.

The persisted model still uses the historical `variants` A-D fields. PATTERN mode now interprets them as consecutive 16-step sections of one pattern. SONG clips can still reference an individual A-D section. Do not introduce a parallel pattern-length model without an explicit architectural decision.

## Relevant implementation

- `src/patterns/patternRecording.ts` — TAKE snapshots, OVERDUB/REPLACE, section length and restore operations.
- `src/patterns/usePatternTakeHistory.ts` — TAKE-only undo/redo history.
- `src/audio/StepSequencer.ts` — audio-clock A-D section traversal and looping.
- `src/App.tsx` — REC lifecycle, count-in/punch-in integration and history wiring.
- `src/shell/TransportBar.tsx` — REC mode selector and TAKE history controls.
- `src/sequencer/SequencerControls.tsx` — global step labels 1-64.
- `tests/patternRecording.test.ts` — regression coverage for the recording workflow.

## Last validation

- `pnpm.cmd test`: 55/55 passed.
- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd build`: passed.
- `git diff --check`: passed.
- Local UI check at desktop and 360 px: no horizontal overflow or console errors; OVERDUB/REPLACE interlock, REC pressed state, empty TAKE, and B step labels 17-32 behaved correctly.
- Vercel production deployment returned HTTP 200.

The Vite build still reports the pre-existing warning that the main JavaScript chunk exceeds 500 kB. Do not broaden unrelated work to address it unless requested.

## Manual checks still outstanding

- Full current Chrome and Edge testing on Windows.
- Real musical recording through A/B/C/D boundaries, including STOP exactly on a section boundary.
- REPLACE plus TAKE UNDO/REDO with existing musical content.
- Several complete 64-step passes and touch testing on real hardware.
- No claim was made that real WAV import/playback was tested in the required Chrome/Edge matrix.

Do not begin another milestone or commit/push/deploy future work unless Damian explicitly requests it.
