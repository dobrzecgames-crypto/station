import type { RuntimeSampleAsset, SampleAssetId } from '../audio/AudioEngine'
import type { StoredAssetRecord } from './storageTypes'

/** Stable asset IDs are immutable blob identities. Existing keys are left
 * untouched; normal manifest saves therefore do not rewrite audio data. */
export async function writeMissingRuntimeAssets(
  store: Pick<IDBObjectStore, 'getKey' | 'put'>,
  assetIds: readonly SampleAssetId[],
  runtimeAssets: ReadonlyMap<SampleAssetId, RuntimeSampleAsset>,
): Promise<number> {
  const results = await Promise.all(assetIds.map((assetId) => new Promise<number>((resolve, reject) => {
    const lookup = store.getKey(assetId)
    lookup.onerror = () => reject(lookup.error ?? new Error(`Could not check WAV asset ${assetId}.`))
    lookup.onsuccess = () => {
      if (lookup.result !== undefined) {
        resolve(0)
        return
      }
      const asset = runtimeAssets.get(assetId)
      if (!asset) {
        reject(new Error(`Project cannot be saved because WAV asset ${assetId} is unavailable.`))
        return
      }
      const record: StoredAssetRecord = {
        id: assetId,
        filename: asset.filename,
        mimeType: asset.blob.type,
        size: asset.blob.size,
        blob: asset.blob,
      }
      const write = store.put(record)
      write.onerror = () => reject(write.error ?? new Error(`Could not store WAV asset ${assetId}.`))
      write.onsuccess = () => resolve(1)
    }
  })))
  return results.reduce((sum, count) => sum + count, 0)
}
