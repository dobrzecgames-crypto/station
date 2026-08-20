import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const sampleFilename = '1998 - Kick 1.wav'
const projectName = 'Station Browser Smoke'

test('startup, built-in assets, transport, save, reload, and project restore remain coherent', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))

  await page.goto('/?diagnostics=1')
  await expect(page.getByRole('region', { name: 'STATION', exact: true })).toBeVisible()
  await startAudio(page)

  await page.getByRole('button', { name: 'LASER', exact: true }).click()
  const chop = page.getByRole('region', { name: 'Chop', exact: true })
  await chop.getByRole('button', { name: '1', exact: true }).click()
  await expect(chop.getByRole('button', { name: 'Preview source', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'PADS', exact: true }).click()

  await page.getByRole('button', { name: 'PAD 01 sample browser settings', exact: true }).click()
  await page.getByRole('button', { name: 'SELECT', exact: true }).first().click()
  await page.getByRole('button', { name: `Drop ${sampleFilename} to PAD 01`, exact: true }).click()
  const loadedPad = page.getByRole('button', { name: `PAD 01, loaded: ${sampleFilename}`, exact: true })
  await expect(loadedPad).toBeVisible()
  await loadedPad.click()

  await exerciseTransport(page, 10)

  await openProjectControls(page)
  await page.getByRole('button', { name: 'SAVE PROJECT', exact: true }).click()
  const nameDialog = page.getByRole('dialog', { name: 'NAME THIS PROJECT', exact: true })
  await nameDialog.getByLabel('PROJECT NAME', { exact: true }).fill(projectName)
  await nameDialog.getByRole('button', { name: 'SAVE PROJECT', exact: true }).click()
  await expect(page.getByText('SAVE STATE / SAVED', { exact: true })).toBeVisible()

  const savedProjectId = await waitForDiagnosticValue(page, 'PROJECT', 'ID', (value) => value !== 'UNSAVED')

  await page.reload()
  await expect(page.getByRole('region', { name: 'STATION', exact: true })).toBeVisible()
  await startAudio(page)
  await openProjectControls(page)
  await page.getByRole('button', { name: 'LIBRARY', exact: true }).click()

  const library = page.getByRole('dialog', { name: 'PROJECT LIBRARY', exact: true })
  const savedProjectRow = library.locator('.project-library-row').filter({ hasText: projectName })
  await expect(savedProjectRow).toBeVisible()
  await savedProjectRow.getByRole('button', { name: 'OPEN', exact: true }).click()
  await expect(library).toBeHidden()

  await expect(page.getByRole('button', { name: `PAD 01, loaded: ${sampleFilename}`, exact: true })).toBeVisible()
  await expect.poll(() => diagnosticValue(page, 'PROJECT', 'ID')).toBe(savedProjectId)
  await expect.poll(() => diagnosticValue(page, 'PROJECT', 'SAVE')).toBe('SAVED')
  await exerciseTransport(page, 1)

  expect(pageErrors).toEqual([])
})

async function startAudio(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start audio', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Audio on', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
}

async function openProjectControls(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Project controls', exact: true }).click()
  const settings = page.getByRole('button', { name: 'Project controls settings', exact: true })
  if (await settings.getAttribute('aria-expanded') !== 'true') await settings.click()
}

async function exerciseTransport(page: Page, cycleCount: number): Promise<void> {
  const play = page.getByRole('button', { name: 'Play', exact: true })
  const stop = page.getByRole('button', { name: 'Stop', exact: true })
  for (let cycle = 0; cycle < cycleCount; cycle += 1) {
    await play.click()
    await expect(play).toBeDisabled()
    await expect(stop).toBeEnabled()
    await stop.click()
    await expect(play).toBeEnabled()
    await expect(stop).toBeDisabled()
  }
  await expect.poll(() => diagnosticValue(page, 'VOICES', 'SEQ SAMPLE')).toBe('0')
  await expect.poll(() => diagnosticValue(page, 'VOICES', 'TIMELINE')).toBe('0')
}

async function waitForDiagnosticValue(
  page: Page,
  group: string,
  label: string,
  predicate: (value: string) => boolean,
): Promise<string> {
  let value = ''
  await expect.poll(async () => {
    value = await diagnosticValue(page, group, label)
    return predicate(value)
  }).toBe(true)
  return value
}

async function diagnosticValue(page: Page, group: string, label: string): Promise<string> {
  const panel = page.getByTestId('station-diagnostics')
  const diagnosticGroup = panel.locator('.internal-diagnostics-group').filter({
    has: page.getByRole('heading', { name: group, exact: true }),
  })
  const row = diagnosticGroup.locator('dl > div').filter({
    has: page.getByText(label, { exact: true }),
  })
  return row.locator('dd').innerText()
}
