import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import type { CDPSession, Locator, Page, TestInfo } from '@playwright/test'

const sampleFilename = '1998 - Kick 1.wav'
const samplePath = resolve(import.meta.dirname, '..', 'public', 'library', 'kicks', sampleFilename)
const trackSampleFilename = 'A1.wav'
const trackSamplePath = resolve(import.meta.dirname, '..', 'public', 'library', 'breaks', trackSampleFilename)

interface TouchPoint {
  id: number
  x: number
  y: number
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext
    const qa = {
      contexts: [] as AudioContext[],
      pointerTypes: [] as string[],
      clipEvents: [] as Array<{ type: string; pointerId: number; pointerType: string; clientX: number }>,
      visibility: 'visible' as DocumentVisibilityState,
    }
    Object.defineProperty(window, '__stationMobileQa', { configurable: true, value: qa })
    class QaAudioContext extends NativeAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options)
        qa.contexts.push(this)
      }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: QaAudioContext })
    document.addEventListener('pointerdown', (event) => qa.pointerTypes.push(event.pointerType), true)
  })
})

test('mobile viewport, touch capability, layout, and orientation switching remain coherent', async ({ page }, testInfo) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'STATION', exact: true })).toBeVisible({ timeout: 15_000 })

  const initialViewport = page.viewportSize()!
  const startsLandscape = testInfo.project.name.endsWith('landscape')
  expect(initialViewport.width > initialViewport.height).toBe(startsLandscape)
  expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0)
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
  expect(await page.evaluate(() => typeof PointerEvent)).toBe('function')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

  const coreOverflow = await page.locator('.station-header button, .main-navigation button').evaluateAll((elements) => elements
    .filter((element) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
    })
    .filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.left < -1 || rect.right > window.innerWidth + 1
    })
    .map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim() ?? element.tagName))
  expect(coreOverflow).toEqual([])

  expect(await computedTouchAction(page.locator('.pad').first())).toBe('none')
  expect(await computedTouchAction(page.getByRole('button', { name: 'LASER', exact: true }))).toBe('manipulation')

  await page.getByRole('button', { name: 'Start audio', exact: true }).tap()
  await expect(page.getByRole('button', { name: 'Audio on', exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as typeof window & { __stationMobileQa: { pointerTypes: string[] } }).__stationMobileQa.pointerTypes)).toContain('touch')

  await page.getByRole('button', { name: 'WAVES', exact: true }).tap()
  await expect(page.locator(startsLandscape ? '.tracks-arranger' : '.tracks-workspace')).toBeVisible()

  await page.setViewportSize({ width: initialViewport.height, height: initialViewport.width })
  await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')))
  await expect(page.locator(startsLandscape ? '.tracks-workspace' : '.tracks-arranger')).toBeVisible()
  await expect(page.getByRole('button', { name: 'WAVES', exact: true })).toHaveClass(/main-nav-button-active/)

  await page.setViewportSize(initialViewport)
  await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')))
  await expect(page.locator(startsLandscape ? '.tracks-arranger' : '.tracks-workspace')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('MIX faders survive repeated touch release, cancellation, and unavailable pointer capture', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'STATION', exact: true })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Start audio', exact: true }).tap()
  await expect(page.getByRole('button', { name: 'Audio on', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'MIX', exact: true }).tap()

  const cdp = await page.context().newCDPSession(page)
  const faders = page.locator('.mixer-strip-fader input[type="range"]')
  await expect(faders).toHaveCount(8)

  const firstFader = faders.nth(0)
  await firstFader.evaluate((element) => {
    element.addEventListener('pointerdown', (event) => {
      ;(element as HTMLElement).dataset.qaLastPointerId = String((event as PointerEvent).pointerId)
    })
  })
  for (let dragIndex = 0; dragIndex < 10; dragIndex += 1) {
    const before = Number(await firstFader.inputValue())
    const deltaY = before > 0.55 ? 54 : -54
    await cdpVerticalDrag(cdp, firstFader, deltaY, false, 600 + dragIndex)
    await expect.poll(async () => Number(await firstFader.inputValue())).not.toBe(before)
    expect(await firstFader.evaluate((element) => {
      const pointerId = Number((element as HTMLElement).dataset.qaLastPointerId)
      return Number.isFinite(pointerId) && (element as HTMLInputElement).hasPointerCapture(pointerId)
    })).toBe(false)
  }

  const secondFader = faders.nth(1)
  const secondBeforeCancel = Number(await secondFader.inputValue())
  await cdpVerticalDrag(cdp, secondFader, 48, true, 700)
  await expect.poll(async () => Number(await secondFader.inputValue())).not.toBe(secondBeforeCancel)
  const secondAfterCancel = Number(await secondFader.inputValue())
  await cdpVerticalDrag(cdp, secondFader, -48, false, 701)
  await expect.poll(async () => Number(await secondFader.inputValue())).not.toBe(secondAfterCancel)

  const thirdFader = faders.nth(2)
  const thirdBefore = Number(await thirdFader.inputValue())
  await cdpVerticalDrag(cdp, thirdFader, 52, false, 702)
  await expect.poll(async () => Number(await thirdFader.inputValue())).not.toBe(thirdBefore)

  // Some mobile range controls accept setPointerCapture() without throwing but
  // never establish durable capture. The terminal event then lands on document,
  // exactly as it does when a finger leaves the native control on the phone.
  await thirdFader.evaluate((element) => {
    const input = element as HTMLInputElement
    Object.defineProperties(input, {
      setPointerCapture: { configurable: true, value: () => {} },
      hasPointerCapture: { configurable: true, value: () => false },
    })
    const rect = input.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 801, pointerType: 'touch', clientX: x, clientY: y }))
    input.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 801, pointerType: 'touch', clientX: x, clientY: y + 60 }))
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 801, pointerType: 'touch', clientX: x, clientY: y + 60 }))
  })
  const afterUnavailableCaptureRelease = Number(await thirdFader.inputValue())
  const secondMoveWasCanceled = await thirdFader.evaluate((element) => {
    const input = element as HTMLInputElement
    const rect = input.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 802, pointerType: 'touch', clientX: x, clientY: y }))
    const wasCanceled = !input.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 802, pointerType: 'touch', clientX: x, clientY: y - 60 }))
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 802, pointerType: 'touch', clientX: x, clientY: y - 60 }))
    return wasCanceled
  })
  await expect.poll(async () => Number(await thirdFader.inputValue())).not.toBe(afterUnavailableCaptureRelease)
  expect(secondMoveWasCanceled).toBe(true)
  await thirdFader.evaluate((element) => {
    Reflect.deleteProperty(element, 'setPointerCapture')
    Reflect.deleteProperty(element, 'hasPointerCapture')
  })

  const fourthFader = faders.nth(3)
  const releasedCapture = await fourthFader.evaluate((element) => {
    const input = element as HTMLInputElement
    input.dataset.qaCaptured = 'false'
    input.dataset.qaReleaseCount = '0'
    Object.defineProperties(input, {
      setPointerCapture: { configurable: true, value: () => { input.dataset.qaCaptured = 'true' } },
      hasPointerCapture: { configurable: true, value: () => input.dataset.qaCaptured === 'true' },
      releasePointerCapture: {
        configurable: true,
        value: () => {
          input.dataset.qaCaptured = 'false'
          input.dataset.qaReleaseCount = String(Number(input.dataset.qaReleaseCount) + 1)
        },
      },
    })
    const rect = input.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 803, pointerType: 'touch', clientX: x, clientY: y }))
    input.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 803, pointerType: 'touch', clientX: x, clientY: y + 40 }))
    input.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 803, pointerType: 'touch', clientX: x, clientY: y + 40 }))
    const result = { captured: input.dataset.qaCaptured, releases: Number(input.dataset.qaReleaseCount) }
    Reflect.deleteProperty(input, 'setPointerCapture')
    Reflect.deleteProperty(input, 'hasPointerCapture')
    Reflect.deleteProperty(input, 'releasePointerCapture')
    return result
  })
  expect(releasedCapture).toEqual({ captured: 'false', releases: 1 })
})

test('MIX fader drag owns page motion without blocking interaction outside the fader', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'STATION', exact: true })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Start audio', exact: true }).tap()
  await page.getByRole('button', { name: 'MIX', exact: true }).tap()

  const cdp = await page.context().newCDPSession(page)
  const firstFader = page.locator('.mixer-strip-fader input[type="range"]').first()
  const faderSurface = page.locator('.mixer-strip-fader').first()
  const workspaceScroll = page.locator('.station-workspace')
  await firstFader.scrollIntoViewIfNeeded()
  expect(await computedTouchAction(firstFader)).toBe('none')
  expect(await computedTouchAction(faderSurface)).toBe('none')

  const scrollBeforeFaderDrag = await workspaceScroll.evaluate((element) => element.scrollTop)
  await cdpVerticalDrag(cdp, firstFader, 92, false, 901)
  expect(await workspaceScroll.evaluate((element) => element.scrollTop)).toBe(scrollBeforeFaderDrag)

  const mute = page.getByRole('button', { name: 'PAD 01 mute', exact: true })
  await mute.tap()
  await expect(mute).toHaveAttribute('aria-pressed', 'true')

  const outsideSurface = page.locator('.mixer-meter-legend')
  await outsideSurface.scrollIntoViewIfNeeded()
  const outsideStart = await centerOf(outsideSurface, 902)
  const scrollBeforeOutsideSwipe = await workspaceScroll.evaluate((element) => element.scrollTop)
  const workspaceCanScroll = await workspaceScroll.evaluate((element) => element.scrollHeight > element.clientHeight + 1)
  if (workspaceCanScroll) {
    await cdpSwipe(cdp, outsideStart, { ...outsideStart, y: Math.max(8, outsideStart.y - 120) })
    await expect.poll(() => workspaceScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(scrollBeforeOutsideSwipe)
  } else {
    expect(scrollBeforeOutsideSwipe).toBe(0)
  }
})

test('portrait touch workflow covers pads, pointercancel, multitouch, sliders, transport, TRACKS, persistence, render, and audio recovery', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('landscape'), 'The full workflow runs once per emulated device; landscape receives its own layout/orientation pass.')

  const pageErrors: Error[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error))
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })

  await page.goto('/?diagnostics=1')
  await page.addStyleTag({ content: '.internal-diagnostics { left: -10000px !important; right: auto !important; pointer-events: none !important; }' })
  await expect(page.getByRole('region', { name: 'STATION', exact: true })).toBeVisible({ timeout: 15_000 })
  await startAudio(page)
  const cdp = await page.context().newCDPSession(page)

  await loadBundledSample(page)
  const loadedPad = page.getByRole('button', { name: `PAD 01, loaded: ${sampleFilename}`, exact: true })
  const emptyPad = page.getByRole('button', { name: 'PAD 02, empty', exact: true })
  await expect(loadedPad).toBeVisible()

  await touchStart(cdp, [await centerOf(loadedPad, 1)])
  await expect(loadedPad).toHaveAttribute('data-pressed', 'true')
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await expect(loadedPad).toHaveAttribute('data-pressed', 'false')

  for (let tapIndex = 0; tapIndex < 32; tapIndex += 1) await cdpTap(cdp, await centerOf(loadedPad, tapIndex + 10))
  await expect(loadedPad).toHaveAttribute('data-pressed', 'false')
  await expect.poll(() => diagnosticValue(page, 'VOICES', 'MANUAL / PREVIEW')).toMatch(/^0 \/ 0$/)

  await touchStart(cdp, [await centerOf(loadedPad, 101), await centerOf(emptyPad, 102)])
  await expect(loadedPad).toHaveAttribute('data-pressed', 'true')
  await expect(emptyPad).toHaveAttribute('data-pressed', 'true')
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(loadedPad).toHaveAttribute('data-pressed', 'false')
  await expect(emptyPad).toHaveAttribute('data-pressed', 'false')

  await createSongMaterial(page)
  await exerciseTransportByTouch(page, 12)

  await createBassic(page)
  const synthEditor = page.getByRole('region', { name: 'BASSIC editor for PAD 01', exact: true })
  const synthSlider = synthEditor.locator('input[type="range"]').first()
  await synthSlider.scrollIntoViewIfNeeded()
  await expect(synthSlider).toBeVisible()
  expect(await computedTouchAction(synthSlider)).toBe('none')
  const initialSliderValue = await synthSlider.inputValue()
  await cdpDrag(cdp, synthSlider, 70, true)
  await cdpDrag(cdp, synthSlider, 110, false)
  await expect.poll(() => synthSlider.inputValue()).not.toBe(initialSliderValue)

  const synthAudition = page.getByRole('button', { name: 'Hold to play synth', exact: true })
  await synthAudition.scrollIntoViewIfNeeded()
  await touchStart(cdp, [await centerOf(synthAudition, 201)])
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await expect.poll(() => diagnosticValue(page, 'VOICES', 'SYNTH')).toBe('0')

  await page.getByRole('button', { name: 'WAVES', exact: true }).tap()
  const addTrackInput = page.locator('.tracks-add-track-button input[type="file"]')
  await addTrackInput.setInputFiles(trackSamplePath)
  const trackClip = page.locator('.tracks-clip').first()
  await expect(trackClip).toBeVisible({ timeout: 15_000 })
  const timelineScroll = page.locator('.tracks-timeline-scroll').first()
  expect(await computedTouchAction(timelineScroll)).toBe('pan-x')
  expect(await computedTouchAction(trackClip)).toBe('none')

  const timelineBox = await timelineScroll.boundingBox()
  expect(timelineBox).not.toBeNull()
  const panY = timelineBox!.y + Math.min(timelineBox!.height - 8, 10)
  const panStartX = timelineBox!.x + Math.min(timelineBox!.width - 16, 280)
  await cdpSwipe(cdp, { id: 301, x: panStartX, y: panY }, { id: 301, x: Math.max(timelineBox!.x + 20, panStartX - 180), y: panY })
  await expect.poll(() => timelineScroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  await timelineScroll.evaluate((element) => { element.scrollLeft = 0 })

  await trackClip.evaluate((element) => {
    const qa = (window as typeof window & { __stationMobileQa: { clipEvents: Array<{ type: string; pointerId: number; pointerType: string; clientX: number }> } }).__stationMobileQa
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      element.addEventListener(type, (event) => {
        const pointer = event as PointerEvent
        qa.clipEvents.push({ type, pointerId: pointer.pointerId, pointerType: pointer.pointerType, clientX: pointer.clientX })
      }, true)
    }
  })
  const clipLeftBefore = await trackClip.evaluate((element) => getComputedStyle(element).left)
  const clipBox = await trackClip.boundingBox()
  expect(clipBox).not.toBeNull()
  const visibleClipLeft = Math.max(clipBox!.x, timelineBox!.x)
  const visibleClipRight = Math.min(clipBox!.x + clipBox!.width, timelineBox!.x + timelineBox!.width)
  expect(visibleClipRight - visibleClipLeft).toBeGreaterThan(90)
  await cdpDragFromPoint(cdp, {
    id: 501,
    x: Math.min(visibleClipRight - 45, visibleClipLeft + 80),
    y: clipBox!.y + clipBox!.height / 2,
  }, 96, false)
  const clipEvents = await page.evaluate(() => (window as typeof window & { __stationMobileQa: { clipEvents: Array<{ type: string; pointerType: string }> } }).__stationMobileQa.clipEvents)
  expect(clipEvents.map((event) => event.type)).toEqual(expect.arrayContaining(['pointerdown', 'pointermove', 'pointerup']))
  expect(clipEvents.every((event) => event.pointerType === 'touch')).toBe(true)
  await expect.poll(() => trackClip.evaluate((element) => getComputedStyle(element).left)).not.toBe(clipLeftBefore)

  const initialViewport = page.viewportSize()!
  await page.setViewportSize({ width: initialViewport.height, height: initialViewport.width })
  await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')))
  await expect(page.locator('.tracks-arranger')).toBeVisible()
  await expect(page.locator('.tracks-clip').first()).toContainText(trackSampleFilename)
  await page.setViewportSize(initialViewport)
  await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')))
  await expect(page.locator('.tracks-workspace')).toBeVisible()

  const projectName = `Station Mobile RC ${testInfo.project.name}`
  await saveProject(page, projectName)
  await simulateBackgroundAndAudioRecovery(page)

  const renderDownload = page.waitForEvent('download')
  await openProjectControls(page)
  await page.getByRole('button', { name: 'RENDER', exact: true }).tap()
  const wavPath = await (await renderDownload).path()
  expect(wavPath).not.toBeNull()
  const wav = await readFile(wavPath!)
  expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF')
  expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE')
  expect(wav.subarray(44).some((sampleByte) => sampleByte !== 0)).toBe(true)
  await expect.poll(() => diagnosticValue(page, 'RENDER', 'ACTIVE')).toBe('NO')

  await page.reload()
  await page.addStyleTag({ content: '.internal-diagnostics { left: -10000px !important; right: auto !important; pointer-events: none !important; }' })
  await expect(page.getByRole('region', { name: 'STATION', exact: true })).toBeVisible({ timeout: 15_000 })
  await startAudio(page)
  await openProjectControls(page)
  await page.getByRole('button', { name: 'LIBRARY', exact: true }).tap()
  const library = page.getByRole('dialog', { name: 'PROJECT LIBRARY', exact: true })
  const row = library.locator('.project-library-row').filter({ hasText: projectName })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'OPEN', exact: true }).tap()
  await expect(library).toBeHidden()
  await expect(page.getByRole('button', { name: 'PAD 01, loaded: BASSIC', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'BANK 02', exact: true }).tap()
  await page.getByRole('option', { name: 'BANK 01', exact: true }).tap()
  await expect(page.getByRole('button', { name: `PAD 01, loaded: ${sampleFilename}`, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'WAVES', exact: true }).tap()
  await expect(page.locator('.tracks-clip').first()).toContainText(trackSampleFilename)
  await expect.poll(() => diagnosticValue(page, 'PROJECT', 'SAVE')).toBe('SAVED')

  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
})

async function startAudio(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start audio', exact: true }).tap()
  await expect(page.getByRole('button', { name: 'Audio on', exact: true })).toBeVisible()
  await expect.poll(() => diagnosticValue(page, 'AUDIO', 'CONTEXT')).toBe('RUNNING')
}

async function loadBundledSample(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'PAD 01 sample browser settings', exact: true }).tap()
  await page.getByRole('button', { name: 'SELECT', exact: true }).first().tap()
  await page.getByRole('button', { name: `Drop ${sampleFilename} to PAD 01`, exact: true }).tap()
}

async function createSongMaterial(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'SEQ', exact: true }).tap()
  expect(await computedTouchAction(page.locator('.pattern-pad-label').first())).toBe('pan-y')
  expect(await computedTouchAction(page.locator('.pattern-step').first())).toBe('pan-y')
  await page.getByRole('button', { name: 'PAD 01, step 1, empty', exact: true }).tap()
  await expect(page.getByRole('button', { name: 'PAD 01, step 1, active', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'SONG', exact: true }).tap()
  await page.getByRole('button', { name: '1A, slot 1, empty', exact: true }).tap()
  await expect(page.getByRole('button', { name: '1A, slot 1, filled', exact: true })).toBeVisible()
}

async function createBassic(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'SYNTH', exact: true }).tap()
  await page.getByRole('button', { name: /BASSIC/ }).tap()
  await page.getByRole('button', { name: 'OPEN ON NEW PATTERN', exact: true }).tap()
  await expect(page.getByRole('region', { name: 'BASSIC editor for PAD 01', exact: true })).toBeVisible()
}

async function exerciseTransportByTouch(page: Page, cycles: number): Promise<void> {
  const play = page.getByRole('button', { name: 'Play', exact: true })
  const stop = page.getByRole('button', { name: 'Stop', exact: true })
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    await play.tap()
    await expect(play).toBeDisabled()
    await stop.tap()
    await expect(play).toBeEnabled()
  }
  await expect.poll(() => diagnosticValue(page, 'TRANSPORT', 'STEP SCHEDULER')).toBe('STOPPED')
  await expect.poll(() => diagnosticValue(page, 'TRANSPORT', 'TIMELINE')).toBe('STOPPED')
}

async function openProjectControls(page: Page): Promise<void> {
  const project = page.getByRole('button', { name: 'Project controls', exact: true })
  if (await project.getAttribute('aria-pressed') !== 'true') await project.tap()
  const settings = page.getByRole('button', { name: 'Project controls settings', exact: true })
  if (await settings.getAttribute('aria-expanded') !== 'true') await settings.tap()
}

async function saveProject(page: Page, name: string): Promise<void> {
  await openProjectControls(page)
  await page.getByRole('button', { name: 'SAVE PROJECT', exact: true }).tap()
  const dialog = page.getByRole('dialog', { name: 'NAME THIS PROJECT', exact: true })
  await dialog.getByLabel('PROJECT NAME', { exact: true }).fill(name)
  await dialog.getByRole('button', { name: 'SAVE PROJECT', exact: true }).tap()
  await expect.poll(() => diagnosticValue(page, 'PROJECT', 'SAVE')).toBe('SAVED')
}

async function simulateBackgroundAndAudioRecovery(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const qa = (window as typeof window & { __stationMobileQa: { contexts: AudioContext[]; visibility: DocumentVisibilityState } }).__stationMobileQa
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => qa.visibility })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => qa.visibility !== 'visible' })
    await qa.contexts[0].suspend()
    qa.visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => diagnosticValue(page, 'AUDIO', 'CONTEXT')).toBe('SUSPENDED')
  await page.evaluate(() => {
    const qa = (window as typeof window & { __stationMobileQa: { visibility: DocumentVisibilityState } }).__stationMobileQa
    qa.visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => diagnosticValue(page, 'AUDIO', 'CONTEXT')).toBe('RUNNING')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
}

async function diagnosticValue(page: Page, group: string, label: string): Promise<string> {
  const panel = page.getByTestId('station-diagnostics')
  const diagnosticGroup = panel.locator('.internal-diagnostics-group').filter({
    has: page.getByRole('heading', { name: group, exact: true }),
  })
  const row = diagnosticGroup.locator('dl > div').filter({ has: page.getByText(label, { exact: true }) })
  return row.locator('dd').innerText()
}

async function computedTouchAction(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).touchAction)
}

async function centerOf(locator: Locator, id: number): Promise<TouchPoint> {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (!box) throw new Error('Touch target has no bounding box.')
  return { id, x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function touchStart(cdp: CDPSession, points: TouchPoint[]): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points.map(toCdpPoint) })
}

async function cdpTap(cdp: CDPSession, point: TouchPoint): Promise<void> {
  await touchStart(cdp, [point])
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function cdpSwipe(cdp: CDPSession, start: TouchPoint, end: TouchPoint): Promise<void> {
  await touchStart(cdp, [start])
  await delay(20)
  for (let step = 1; step <= 5; step += 1) {
    const ratio = step / 5
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [toCdpPoint({ id: start.id, x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio })],
    })
    await delay(12)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function cdpDrag(cdp: CDPSession, locator: Locator, deltaX: number, cancel: boolean): Promise<void> {
  await cdpDragFromPoint(cdp, await centerOf(locator, 401), deltaX, cancel)
}

async function cdpVerticalDrag(cdp: CDPSession, locator: Locator, deltaY: number, cancel: boolean, id: number): Promise<void> {
  const start = await centerOf(locator, id)
  await touchStart(cdp, [start])
  await delay(20)
  for (let step = 1; step <= 5; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [toCdpPoint({ ...start, y: start.y + deltaY * step / 5 })],
    })
    await delay(12)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] })
}

async function cdpDragFromPoint(cdp: CDPSession, start: TouchPoint, deltaX: number, cancel: boolean): Promise<void> {
  await touchStart(cdp, [start])
  await delay(20)
  for (let step = 1; step <= 5; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [toCdpPoint({ ...start, x: start.x + deltaX * step / 5 })],
    })
    await delay(12)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] })
}

function toCdpPoint(point: TouchPoint) {
  return { ...point, radiusX: 6, radiusY: 6, force: 1 }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}
