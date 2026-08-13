/**
 * Reads the single CSS-owned physical UI scale for pixel geometry that has to
 * be calculated in JavaScript (canvas detail, pointer hit slop and timeline
 * zoom). Browser layout remains the source of truth; tests/SSR safely use the
 * authored value when no document exists.
 */
export function scaleStationUiPixels(pixels: number): number {
  if (typeof document === 'undefined') return pixels
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--station-ui-scale'))
  return Number.isFinite(value) && value > 0 ? pixels * value : pixels
}
