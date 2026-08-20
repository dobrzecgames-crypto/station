import assert from 'node:assert/strict'
import test from 'node:test'
import { ApplicationErrorLog, formatApplicationErrorReport } from '../src/diagnostics/ApplicationErrorLog.ts'

test('application error capture stays bounded and retains the newest local entries', () => {
  let tick = 0
  const log = new ApplicationErrorLog(2, () => new Date(Date.UTC(2026, 7, 20, 10, 0, tick++)))

  log.record('window-error', new Error('first'))
  log.record('unhandled-rejection', 'second')
  log.record('react', new TypeError('third'))

  assert.deepEqual(log.getEntries().map((entry) => entry.message), ['second', 'third'])
  assert.deepEqual(log.getEntries().map((entry) => entry.source), ['unhandled-rejection', 'react'])
})

test('diagnostic report safely formats non-Error rejections and a React component stack', () => {
  const log = new ApplicationErrorLog(20, () => new Date('2026-08-20T10:00:00.000Z'))
  log.record('unhandled-rejection', { code: 'offline', retryable: true })

  const report = formatApplicationErrorReport(log.getEntries(), '\n    at TestSurface')

  assert.match(report, /STATION LOCAL ERROR REPORT/)
  assert.match(report, /SOURCE: unhandled-rejection/)
  assert.match(report, /MESSAGE: \{"code":"offline","retryable":true\}/)
  assert.match(report, /REACT COMPONENT STACK:\n+at TestSurface/)
})
