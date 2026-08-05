import { libraryAssetUrl } from '../library/libraryAssetUrl'

export interface ChopTestSample {
  id: string
  label: string
  filename: string
  url: string
}

export const chopTestSamples: readonly ChopTestSample[] = [
  { id: 'chop-sample-1', label: '1', filename: 'Sample 1.wav', url: libraryAssetUrl('chop-sample-1.wav') },
  { id: 'chop-sample-2', label: '2', filename: 'Sample 2.wav', url: libraryAssetUrl('chop-sample-2.wav') },
  { id: 'chop-sample-3', label: '3', filename: 'Sample 3.wav', url: libraryAssetUrl('chop-sample-3.wav') },
  { id: 'chop-sample-4', label: '4', filename: 'Sample 4.wav', url: libraryAssetUrl('chop-sample-4.wav') },
  { id: 'chop-sample-5', label: '5', filename: 'Sample 5.wav', url: libraryAssetUrl('chop-sample-5.wav') },
  { id: 'chop-sample-6', label: '6', filename: 'Sample 6.wav', url: libraryAssetUrl('chop-sample-6.wav') },
  { id: 'chop-sample-7', label: '7', filename: 'Sample 7.wav', url: libraryAssetUrl('chop-sample-7.wav') },
]
