import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatDiagnosticBytes,
  formatDiagnosticLatency,
  formatDiagnosticRatio,
  isInternalDiagnosticsEnabled,
} from '../src/diagnostics/internalDiagnostics.ts'

test('internal diagnostics require the exact opt-in query flag', () => {
  assert.equal(isInternalDiagnosticsEnabled('?diagnostics=1'), true)
  assert.equal(isInternalDiagnosticsEnabled('?mode=release&diagnostics=1'), true)
  assert.equal(isInternalDiagnosticsEnabled('?diagnostics=0'), false)
  assert.equal(isInternalDiagnosticsEnabled('?stationCrash=render'), false)
  assert.equal(isInternalDiagnosticsEnabled(''), false)
})

test('diagnostic storage and latency values stay compact and explicit when unavailable', () => {
  assert.equal(formatDiagnosticBytes(null), '—')
  assert.equal(formatDiagnosticBytes(1024 ** 2 * 1.5), '1.5 MiB')
  assert.equal(formatDiagnosticLatency(null), '—')
  assert.equal(formatDiagnosticLatency(0.01234), '12.3 ms')
  assert.equal(formatDiagnosticRatio(0.257), '25.7%')
})
