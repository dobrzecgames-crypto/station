import { expect, test } from '@playwright/test'
import type { CDPSession, Page } from '@playwright/test'

interface TouchPoint { id: number; x: number; y: number }
const toCdpPoint = (point: TouchPoint) => ({ ...point, radiusX: 6, radiusY: 6, force: 1 })
const delay = (ms: number) => new Promise<void>((resolveDelay) => setTimeout(resolveDelay, ms))

async function touchDrag(cdp: CDPSession, start: TouchPoint, deltaX: number, deltaY: number, end: 'touchEnd' | 'touchCancel'): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [toCdpPoint(start)] })
  await delay(20)
  for (let step = 1; step <= 6; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [toCdpPoint({ id: start.id, x: start.x + deltaX * step / 6, y: start.y + deltaY * step / 6 })],
    })
    await delay(14)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: end, touchPoints: [] })
  await delay(60)
}

interface SliderReport { id: string; movedFirst: boolean; movedAfterCancel: boolean }

/** Drag, then cancel a drag, then drag again on every visible range control of
    the current screen. A shared drag primitive that leaks pointer state shows
    up here as a control that answers the first gesture and is dead to the next. */
async function auditSliders(page: Page, cdp: CDPSession, screen: string): Promise<SliderReport[]> {
  const sliders = await page.locator('input[type="range"]:not([disabled])').all()
  const reports: SliderReport[] = []
  for (const [index, slider] of sliders.entries()) {
    if (!await slider.isVisible()) continue
    await slider.scrollIntoViewIfNeeded().catch(() => {})
    const box = await slider.boundingBox()
    if (!box || box.width < 12 || box.height < 8) continue
    const vertical = box.height > box.width
    const identity = await slider.evaluate((element) => element.id || element.getAttribute('aria-label') || 'range')
    const centre: TouchPoint = { id: 900 + index, x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const read = () => slider.evaluate((element) => Number((element as HTMLInputElement).value))
    // Drag towards the middle of the range first: a control already parked at
    // its maximum cannot move further that way, and a clamp would read as an
    // unresponsive slider.
    const span = await slider.evaluate((element) => {
      const input = element as HTMLInputElement
      return { value: Number(input.value), min: Number(input.min), max: Number(input.max) }
    })
    const towardsMiddle = span.value > (span.min + span.max) / 2 ? -1 : 1
    const push = (magnitude: number, sign: number) => vertical
      ? { dx: 0, dy: -magnitude * sign }
      : { dx: magnitude * sign, dy: 0 }

    const before = await read()
    const first = push(70, towardsMiddle)
    await touchDrag(cdp, centre, first.dx, first.dy, 'touchEnd')
    const afterFirst = await read()

    // The browser took the pointer away mid-drag.
    const cancelled = push(50, towardsMiddle)
    await touchDrag(cdp, centre, cancelled.dx, cancelled.dy, 'touchCancel')
    const afterCancel = await read()

    // The control must still answer a fresh gesture.
    const second = push(70, -towardsMiddle)
    await touchDrag(cdp, centre, second.dx, second.dy, 'touchEnd')
    const afterSecond = await read()

    reports.push({
      id: screen + '#' + identity,
      movedFirst: afterFirst !== before,
      movedAfterCancel: afterSecond !== afterCancel,
    })
  }
  return reports
}

async function bootMobile(page: Page): Promise<Error[]> {
  const errors: Error[] = []
  page.on('pageerror', (error) => errors.push(error))
  await page.goto('/?diagnostics=1')
  await expect(page.getByRole('region', { name: 'STATION', exact: true })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Start audio', exact: true }).tap()
  await expect(page.getByRole('button', { name: 'Audio on', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 15_000 })
  return errors
}

async function loadPadSample(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'PADS', exact: true }).tap()
  const padSettings = page.getByRole('button', { name: 'PAD 01 sample browser settings', exact: true })
  if (await padSettings.count() > 0 && await padSettings.getAttribute('aria-expanded') !== 'true') await padSettings.tap()
  await page.getByRole('button', { name: 'SELECT', exact: true }).first().tap()
  await page.locator('button[aria-label^="Drop "][aria-label$="to PAD 01"]').first().tap()
}

async function readDiagnostics(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {}
    const panel = document.querySelector('[data-testid="station-diagnostics"]')
    for (const group of panel?.querySelectorAll('.internal-diagnostics-group') ?? []) {
      const heading = group.querySelector('h2')?.textContent?.trim() ?? '?'
      for (const row of group.querySelectorAll('dl > div')) {
        out[heading + '/' + (row.querySelector('dt')?.textContent?.trim() ?? '?')] = row.querySelector('dd')?.textContent?.trim() ?? ''
      }
    }
    return out
  })
}

test('every shared drag slider survives cancel and answers the next gesture', async ({ page }) => {
  const errors = await bootMobile(page)
  const cdp = await page.context().newCDPSession(page)
  const all: SliderReport[] = []

  await page.getByRole('button', { name: 'SONG', exact: true }).tap()
  const tempo = page.getByRole('button', { name: 'Tempo and playback settings', exact: true })
  if (await tempo.count() > 0 && await tempo.getAttribute('aria-expanded') !== 'true') await tempo.tap()
  all.push(...await auditSliders(page, cdp, 'TEMPO'))

  await loadPadSample(page)
  all.push(...await auditSliders(page, cdp, 'PADS'))

  // Mixer faders: the control class that already failed once on real hardware.
  await page.getByRole('button', { name: 'MIX', exact: true }).tap()
  await page.waitForTimeout(300)
  all.push(...await auditSliders(page, cdp, 'MIX'))

  // A real instrument workspace, not just the tempo floor tenant.
  await page.getByRole('button', { name: 'SYNTH', exact: true }).tap()
  await page.waitForTimeout(300)
  const bassic = page.getByRole('button', { name: /BASSIC/ }).first()
  if (await bassic.count() > 0) {
    await bassic.tap()
    const confirm = page.getByRole('button', { name: 'OPEN ON NEW PATTERN', exact: true })
    if (await confirm.count() > 0) await confirm.tap()
    await page.waitForTimeout(700)
  }
  all.push(...await auditSliders(page, cdp, 'SYNTH'))

  console.log('[sliders] audited', all.length)
  for (const report of all) console.log('[slider]', report.id, 'first=' + report.movedFirst, 'recovers=' + report.movedAfterCancel)
  const dead = all.filter((report) => report.movedFirst && !report.movedAfterCancel)
  console.log('[sliders] dead after cancel:', JSON.stringify(dead.map((report) => report.id)))
  expect(errors).toEqual([])
  expect(dead, 'a cancelled touch must not leave a slider dead to the next gesture').toEqual([])
  expect(all.filter((report) => report.movedFirst).length, 'sliders must respond to touch drags').toBeGreaterThan(0)
})

test('orientation changes during playback keep the transport coherent', async ({ page }) => {
  const errors = await bootMobile(page)
  await loadPadSample(page)
  await page.getByRole('button', { name: 'SEQ', exact: true }).tap()
  await page.getByRole('button', { name: 'PAD 01, step 1, empty', exact: true }).tap()

  const viewport = page.viewportSize()!
  await page.locator('section.transport-bar').getByRole('button', { name: 'Play', exact: true }).tap()
  for (let rotation = 0; rotation < 4; rotation += 1) {
    const rotated = rotation % 2 === 0
    await page.setViewportSize(rotated ? { width: viewport.height, height: viewport.width } : viewport)
    await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')))
    await page.waitForTimeout(500)
  }
  await page.waitForTimeout(1300)
  const during = await readDiagnostics(page)
  console.log('[rotate] while playing:', during['TRANSPORT/STEP SCHEDULER'], during['TRANSPORT/TIMELINE'],
    '| voices', during['VOICES/TOTAL'], '| expired', during['TRANSPORT/EXPIRED'])
  expect(during['TRANSPORT/STEP SCHEDULER'], 'rotating the phone must not stop the transport').toBe('RUNNING')

  await page.setViewportSize(viewport)
  await page.locator('section.transport-bar').getByRole('button', { name: 'Stop', exact: true }).tap()
  await expect.poll(async () => (await readDiagnostics(page))['VOICES/TOTAL'], { timeout: 12_000 }).toBe('0')
  expect(errors).toEqual([])
})
