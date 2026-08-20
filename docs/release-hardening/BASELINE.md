# Release Hardening Baseline

Captured: 2026-08-20 (Europe/Warsaw)

## Repository

- Canonical working directory: `C:\Users\T470\Documents\station`
- Starting branch: `main`
- Hardening branch: `release/station-hardening`
- Starting commit: `0d99b79df89634e5b3c8b5a8a5471b2ee941f750`
- Remote: `origin https://github.com/dobrzecgames-crypto/station.git`
- Initial worktree: clean; `main` tracked `origin/main`
- Node: `v24.14.1`
- pnpm: `11.15.1`
- Package-declared minimum Node: `>=22.12.0`
- Package manager declaration: `pnpm@11.15.1`

## Untouched validation results

### `pnpm test`

PASS.

- Tests: 110
- Passed: 110
- Failed: 0
- Skipped: 0
- Cancelled: 0
- Duration reported by Node test runner: 4534.9751 ms

### `pnpm typecheck`

PASS outside the managed filesystem sandbox.

The first sandboxed attempt failed before TypeScript ran:

```text
EPERM: operation not permitted, open
C:\Users\T470\Documents\station\node_modules\.pnpm\typescript@7.0.2\node_modules\typescript\bin\tsc
```

This was an execution-environment read restriction, not a repository or
TypeScript diagnostic. The identical command passed when allowed to read the
installed compiler.

### `pnpm build`

PASS outside the managed filesystem sandbox.

- Vite: 8.1.5
- Modules transformed: 157
- Build time reported by Vite: 3.06 s
- Main JavaScript: 615.78 kB minified / 173.90 kB gzip
- CSS: 275.88 kB minified / 38.45 kB gzip
- POLY worklet: 14.05 kB

Warnings/advisories:

- The main JavaScript chunk is larger than Vite's 500 kB warning threshold.
- Vite reported plugin time concentrated in CSS processing and output-dir
  preparation. This is a build-performance advisory, not a correctness failure.

## Baseline interpretation

The pre-hardening automated logic gate is green. It does not yet cover the
release-critical browser workflows, Web Audio lifecycle, IndexedDB connection
failure modes, scheduler stalls, active-voice cleanup, or audible output.
