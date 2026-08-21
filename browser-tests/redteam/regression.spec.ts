import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  activeSteps, boot, diagnostics, loadFirstLibrarySampleToPad1,
  openProjectControls, openTempoPanel, paintFirstStep, startAudio, transport,
} from './helpers'

/**
 * Browser regressions for the defects the final red-team pass confirmed. Each
 * one needs a real document lifecycle, a real AudioContext or real touch, so
 * none of them can be expressed as a deterministic Node test.
 * See docs/release-hardening/FINAL_RED_TEAM.md.
 */

const trackWav = 'public/library/breaks/A1.wav'

async function importTrackThenLeaveArranger(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'WAVES', exact: true }).click()
  await page.locator('.tracks-add-track-button input[type="file"]').setInputFiles(trackWav)
  await expect(page.locator('.tracks-clip').first()).toBeVisible({ timeout: 20_000 })
  const exit = page.getByRole('button', { name: 'Back to Station', exact: true })
  if (await exit.count() > 0) await exit.first().click()
  await page.getByRole('button', { name: 'SEQ', exact: true }).click()
  await expect(page.locator('section.transport-bar')).toBeVisible()
}

async function tapPad(page: Page, filename: string, times: number, gapMs: number): Promise<void> {
  const pad = page.getByRole('button', { name: `PAD 01, loaded: ${filename}`, exact: true })
  for (let index = 0; index < times; index += 1) {
    await pad.click()
    await page.waitForTimeout(gapMs)
  }
}

test('a cancelled unload leaves the audio runtime and the pending save intact', async ({ page }) => {
  const errors = await boot(page)
  await startAudio(page)
  const filename = await loadFirstLibrarySampleToPad1(page)

  await openProjectControls(page)
  await page.getByRole('button', { name: 'SAVE PROJECT', exact: true }).click()
  const nameDialog = page.getByRole('dialog', { name: 'NAME THIS PROJECT', exact: true })
  await nameDialog.getByLabel('PROJECT NAME', { exact: true }).fill('RT Unload Regression')
  await nameDialog.getByRole('button', { name: 'SAVE PROJECT', exact: true }).click()
  await expect.poll(async () => (await diagnostics(page))['PROJECT/SAVE']).toBe('SAVED')
  await expect.poll(async () => (await diagnostics(page))['ASSETS / ROUTING/SAMPLES']).not.toBe('0')

  await paintFirstStep(page)
  await expect.poll(async () => (await diagnostics(page))['PROJECT/SAVE']).toBe('DIRTY')

  page.on('dialog', (dialog) => { void dialog.dismiss() })
  await page.reload({ timeout: 4000 }).catch(() => { /* the user chose to stay */ })
  await page.waitForTimeout(1200)

  const after = await diagnostics(page)
  expect(after['AUDIO/CONTEXT'], 'staying on the page must not close the AudioContext').not.toBe('UNAVAILABLE')
  expect(after['ASSETS / ROUTING/SAMPLES'], 'staying on the page must not drop loaded samples').not.toBe('0')

  await openProjectControls(page)
  await page.getByRole('button', { name: 'SAVE PROJECT', exact: true }).click()
  await expect.poll(async () => (await diagnostics(page))['PROJECT/SAVE'], { timeout: 10_000 }).toBe('SAVED')

  await page.getByRole('button', { name: 'PADS', exact: true }).click()
  await expect(page.getByRole('button', { name: `PAD 01, loaded: ${filename}`, exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('PLAY pressed during the REC count-in still records the take', async ({ page }) => {
  const errors = await boot(page)
  await startAudio(page)
  const filename = await loadFirstLibrarySampleToPad1(page)
  await paintFirstStep(page)
  const before = await activeSteps(page)

  await page.getByRole('button', { name: 'PADS', exact: true }).click()
  await transport(page).record.click()
  await expect(page.getByRole('button', { name: 'Counting in, tap to cancel', exact: true })).toBeVisible()
  await page.waitForTimeout(250)
  await transport(page).play.click({ trial: false, force: true }).catch(() => { /* PLAY may be unavailable while counting in */ })
  await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toBeVisible({ timeout: 5000 })

  await tapPad(page, filename, 4, 150)
  await transport(page).stop.click()

  const after = await activeSteps(page)
  expect(errors).toEqual([])
  expect(after.length, 'hits played while REC is lit must reach the pattern').toBeGreaterThan(before.length)
})

test('a REC count-in take starts WAVES on the same downbeat', async ({ page }) => {
  const errors = await boot(page)
  await startAudio(page)
  await loadFirstLibrarySampleToPad1(page)
  await paintFirstStep(page)
  await importTrackThenLeaveArranger(page)

  await transport(page).record.click()
  await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(1600)

  const during = await diagnostics(page)
  await transport(page).stop.click()
  expect(errors).toEqual([])
  expect(during['TRANSPORT/TIMELINE'], 'a recording take is still playback: WAVES must run too').toBe('RUNNING')
  expect(Number(during['TRANSPORT/TRACK BEAT']), 'the WAVES playhead must advance during a take').toBeGreaterThan(0)
})

test('a live tempo change does not teleport the WAVES playhead', async ({ page }) => {
  const errors = await boot(page)
  await startAudio(page)
  await loadFirstLibrarySampleToPad1(page)
  await paintFirstStep(page)
  await importTrackThenLeaveArranger(page)

  await transport(page).play.click()
  await expect.poll(async () => (await diagnostics(page))['TRANSPORT/TIMELINE'], { timeout: 8000 }).toBe('RUNNING')
  await page.waitForTimeout(1500)
  const beatBefore = Number((await diagnostics(page))['TRANSPORT/TRACK BEAT'])

  await openTempoPanel(page)
  await page.locator('#bpm').fill('200')
  await page.waitForTimeout(1400)
  const beatAfter = Number((await diagnostics(page))['TRANSPORT/TRACK BEAT'])

  await transport(page).stop.click()
  expect(errors).toEqual([])
  // Two seconds of real advance at the new tempo is the ceiling; the old code
  // added the whole elapsed span re-measured at 200 bpm on top of that.
  expect(beatAfter - beatBefore, 'a tempo change must not teleport the WAVES playhead').toBeLessThan(2 * (200 / 60))
})

test('auditioning the sound library does not retain every decoded buffer', async ({ page }) => {
  const errors = await boot(page)
  await startAudio(page)
  await loadFirstLibrarySampleToPad1(page)

  let auditioned = 0
  for (let folder = 0; folder < 3; folder += 1) {
    const rows = page.getByRole('button', { name: 'PLAY', exact: true })
    const count = await rows.count()
    for (let index = 0; index < count; index += 1) {
      await rows.nth(index).click({ timeout: 4000 }).catch(() => { /* row may scroll out */ })
      auditioned += 1
      await page.waitForTimeout(50)
    }
    const next = page.getByRole('button', { name: 'Next folder', exact: true })
    if (await next.isEnabled()) await next.click()
  }
  await page.waitForTimeout(1500)

  const after = await diagnostics(page)
  expect(auditioned).toBeGreaterThan(20)
  expect(errors).toEqual([])
  // One project sample plus at most the audition currently loaded.
  expect(Number(after['ASSETS / ROUTING/SAMPLES']), 'auditions must not accumulate for the session').toBeLessThanOrEqual(3)
  expect(Number(after['ASSETS / ROUTING/RUNTIME BLOBS']), 'audition source WAVs must not accumulate either').toBeLessThanOrEqual(3)
})
