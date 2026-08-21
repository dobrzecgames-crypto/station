import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function boot(page: Page): Promise<Error[]> {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))
  await page.goto('/?diagnostics=1')
  await expect(page.getByRole('region', { name: 'STATION', exact: true })).toBeVisible({ timeout: 20_000 })
  return pageErrors
}

export async function startAudio(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start audio', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Audio on', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 15_000 })
}

/** The project tenant keeps the system display until it is released, and the
    pad browser only re-claims when the selected pad id changes. Hand the
    display back so the pad browser can own it again. */
export async function releaseProjectDisplay(page: Page): Promise<void> {
  const projectSettings = page.getByRole('button', { name: 'Project controls settings', exact: true })
  if (await projectSettings.count() > 0) {
    await page.getByRole('button', { name: 'Project controls', exact: true }).click()
    await expect(projectSettings).toHaveCount(0)
  }
}

export async function loadFirstLibrarySampleToPad1(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'PADS', exact: true }).click()
  await releaseProjectDisplay(page)
  const padSettings = page.getByRole('button', { name: 'PAD 01 sample browser settings', exact: true })
  if (await padSettings.count() === 0) {
    // PadDisplay only re-claims the display when the selected pad id changes,
    // so returning from the project tenant to PAD 01 needs a detour.
    await page.locator('button[aria-label^="PAD 02,"]').first().click()
    await page.locator('button[aria-label^="PAD 01,"]').first().click()
  }
  await expect(padSettings).toHaveCount(1)
  if (await padSettings.getAttribute('aria-expanded') !== 'true') await padSettings.click()
  await expect(padSettings).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'SELECT', exact: true }).first().click()
  const drop = page.locator('button[aria-label^="Drop "][aria-label$="to PAD 01"]').first()
  const label = (await drop.getAttribute('aria-label')) ?? ''
  await drop.click()
  const filename = label.replace(/^Drop /, '').replace(/ to PAD 01$/, '')
  await expect(page.getByRole('button', { name: `PAD 01, loaded: ${filename}`, exact: true })).toBeVisible()
  return filename
}

/** Idempotent: claims the system display for the project tenant only when it is
    not already the tenant, then makes sure its panel is expanded. Clicking
    "Project controls" twice releases the claim, which is what hung earlier. */
export async function openProjectControls(page: Page): Promise<void> {
  const settings = page.getByRole('button', { name: 'Project controls settings', exact: true })
  if (await settings.count() === 0) {
    await page.getByRole('button', { name: 'Project controls', exact: true }).click()
    await expect(settings).toHaveCount(1)
  }
  if (await settings.getAttribute('aria-expanded') !== 'true') await settings.click()
  await expect(settings).toHaveAttribute('aria-expanded', 'true')
}

/** Full diagnostics snapshot as a flat record, one DOM read. */
export async function diagnostics(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {}
    const panel = document.querySelector('[data-testid="station-diagnostics"]')
    if (!panel) return out
    for (const group of panel.querySelectorAll('.internal-diagnostics-group')) {
      const heading = group.querySelector('h3,h2,h4')?.textContent?.trim() ?? '?'
      for (const row of group.querySelectorAll('dl > div')) {
        const key = row.querySelector('dt')?.textContent?.trim() ?? '?'
        out[`${heading}/${key}`] = row.querySelector('dd')?.textContent?.trim() ?? ''
      }
    }
    return out
  })
}

/** Every active step across every existing A-D section, using global step numbers. */
export async function activeSteps(page: Page): Promise<string[]> {
  await page.getByRole('button', { name: 'SEQ', exact: true }).click()
  const found = new Set<string>()
  for (const variant of ['A', 'B', 'C', 'D']) {
    const tab = page.getByRole('button', { name: `Pattern ${variant}`, exact: true })
    if (await tab.count() === 0) continue
    await tab.click()
    const tabs = page.getByRole('tablist', { name: 'Step range', exact: true }).getByRole('tab')
    for (let index = 0; index < await tabs.count(); index += 1) {
      await tabs.nth(index).click()
      const labels = await page.locator('button[aria-label$=", active"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
      for (const label of labels) found.add(label)
    }
  }
  return [...found].sort()
}

export async function paintFirstStep(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'SEQ', exact: true }).click()
  await page.getByRole('button', { name: 'PAD 01, step 1, empty', exact: true }).click()
  await expect(page.getByRole('button', { name: 'PAD 01, step 1, active', exact: true })).toBeVisible()
}

/** Tempo is only the display's floor tenant, so it is reachable from a view
    that claims nothing. SONG is the one such workspace. */
export async function openTempoPanel(page: Page): Promise<void> {
  await releaseProjectDisplay(page)
  await page.getByRole('button', { name: 'SONG', exact: true }).click()
  const tempo = page.getByRole('button', { name: 'Tempo and playback settings', exact: true })
  await expect(tempo).toHaveCount(1)
  if (await tempo.getAttribute('aria-expanded') !== 'true') await tempo.click()
  await expect(page.locator('#bpm')).toHaveCount(1)
}

/** WAVES opens a full-screen arranger with its own PLAY/STOP, so every
    transport assertion has to name the transport bar explicitly. */
export function transport(page: Page) {
  const bar = page.locator('section.transport-bar')
  return {
    play: bar.getByRole('button', { name: 'Play', exact: true }),
    stop: bar.getByRole('button', { name: 'Stop', exact: true }),
    record: bar.getByRole('button', { name: 'Record', exact: true }),
  }
}
