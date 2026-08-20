import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { createDefaultOrganicBassPatch } from '../src/organic-bass/organicBassOperations.ts'
import { createDefaultPolyPatch } from '../src/poly/polyOperations.ts'
import { createDefaultSynthPatch } from '../src/synth/synthOperations.ts'
import { applyUserSynthPreset, createUserSynthPreset, isUserSynthPreset, normalizeUserSynthPresetName, userSynthPresetKinds } from '../src/synth-presets/userSynthPresetCore.ts'

const now = '2026-08-13T18:00:00.000Z'

test('every supported synth owns a distinct preset kind', () => {
  assert.deepEqual(userSynthPresetKinds, ['basic', 'monogorg', 'zola-x'])
  assert.equal(new Set(userSynthPresetKinds).size, 3)
})

test('each synth editor is wired only to its own user preset library', () => {
  const sourceRoot = join(import.meta.dirname, '..', 'src')
  const workspaces = [
    ['synth/SynthWorkspace.tsx', 'basic'],
    ['organic-bass/OrganicBassWorkspace.tsx', 'monogorg'],
    ['poly/PolyWorkspace.tsx', 'zola-x'],
  ] as const

  for (const [relativePath, kind] of workspaces) {
    const source = readFileSync(join(sourceRoot, ...relativePath.split('/')), 'utf8')
    assert.match(source, new RegExp(`<UserSynthPresetControls kind="${kind}"`))
    for (const otherKind of userSynthPresetKinds.filter((candidate) => candidate !== kind)) {
      assert.doesNotMatch(source, new RegExp(`<UserSynthPresetControls kind="${otherKind}"`))
    }
  }
})

test('preset names are normalized and empty names are rejected', () => {
  assert.equal(normalizeUserSynthPresetName('  WARM   NIGHT  '), 'WARM NIGHT')
  assert.throws(() => normalizeUserSynthPresetName('   '), /cannot be empty/)
})

test('BASSIC preset restores sound parameters but preserves the current patch identity', () => {
  const source = createDefaultSynthPatch('source')
  source.oscillator1.level = 0.37
  source.filter.cutoffHz = 1234
  const preset = createUserSynthPreset({ id: 'preset-basic', kind: 'basic', name: 'SOFT BASS', patch: source, now })
  const current = createDefaultSynthPatch('current')
  const loaded = applyUserSynthPreset(current, preset)

  assert.equal(loaded.id, 'current')
  assert.equal(loaded.name, 'SOFT BASS')
  assert.equal(loaded.oscillator1.level, 0.37)
  assert.equal(loaded.filter.cutoffHz, 1234)
  assert.notEqual(loaded.oscillator1, preset.patch.oscillator1)
})

test('MONOGORG and ZOLA-X snapshots stay isolated from their live patches', () => {
  const monogorg = createDefaultOrganicBassPatch('mono')
  const zola = createDefaultPolyPatch('zola')
  const monoPreset = createUserSynthPreset({ id: 'preset-mono', kind: 'monogorg', name: 'HEAVY', patch: monogorg, now })
  const zolaPreset = createUserSynthPreset({ id: 'preset-zola', kind: 'zola-x', name: 'GLASS', patch: zola, now })

  monogorg.weight = 0
  zola.modulation[0].amount = -1

  assert.notEqual(monoPreset.patch.weight, monogorg.weight)
  assert.notEqual(zolaPreset.patch.modulation[0].amount, zola.modulation[0].amount)
  assert.equal(isUserSynthPreset(monoPreset), true)
  assert.equal(isUserSynthPreset(zolaPreset), true)
})

test('a preset with an unsupported schema or missing patch is rejected', () => {
  assert.equal(isUserSynthPreset({ schemaVersion: 99, id: 'x', kind: 'basic', name: 'X', createdAt: now, modifiedAt: now, patch: {} }), false)
  assert.equal(isUserSynthPreset({ schemaVersion: 1, id: 'x', kind: 'basic', name: 'X', createdAt: now, modifiedAt: now }), false)
})
