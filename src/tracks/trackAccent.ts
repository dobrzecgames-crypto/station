/**
 * Small fixed palette so each AudioTrack's clips/rail row are visually
 * distinct at a glance - today every track's clip renders in the same flat
 * `--station-accent` tint, so a five-track arrangement is five identical
 * grey-green rectangles. Deliberately its own literal set, not a reuse of
 * index.css's `--accent-*` module accents: those are reserved for
 * `--station-accent` alone ("components must not reference these
 * directly" - index.css), so a second, independent purpose gets its own
 * values instead of quietly borrowing that system. Picked to match the same
 * desaturated, matte character.
 */
const trackAccentPalette = [
  '#a5769d', // dusty violet
  '#c69b61', // sand
  '#87a066', // olive
  '#8fa8c7', // dusty blue
  '#bd6b4a', // terracotta
  '#9a88c3', // lavender
  '#b07085', // dusty rose
  '#78a1b2', // slate teal
] as const

/**
 * Deterministic per-track color, keyed by the track's own id rather than
 * its position in `audioTracks` - reordering a track with the ▲/▼ controls
 * must not shuffle which color it wears.
 */
export function trackAccentColor(trackId: string): string {
  let hash = 0
  for (let index = 0; index < trackId.length; index += 1) hash = (Math.imul(hash, 31) + trackId.charCodeAt(index)) >>> 0
  return trackAccentPalette[hash % trackAccentPalette.length]
}
