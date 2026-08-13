import type { SampleAssetId } from '../audio/AudioEngine'

const stationLibraryAssetPrefix = 'station-library:'

export function createBuiltInLibraryAssetId(sampleId: string): SampleAssetId {
  return `${stationLibraryAssetPrefix}${encodeURIComponent(sampleId)}`
}

export function builtInLibrarySampleIdFromAssetId(assetId: SampleAssetId): string | null {
  if (!assetId.startsWith(stationLibraryAssetPrefix)) return null
  try {
    const sampleId = decodeURIComponent(assetId.slice(stationLibraryAssetPrefix.length))
    return sampleId.length > 0 ? sampleId : null
  } catch {
    return null
  }
}
