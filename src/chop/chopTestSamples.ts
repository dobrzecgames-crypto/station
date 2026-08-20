import { libraryAssetUrl } from '../library/libraryAssetUrl'

export interface ChopTestSample {
  id: string
  label: string
  filename: string
  url: string
}

export const chopTestSamples: readonly ChopTestSample[] = [
  { id: 'chop-sample-1', label: '1', filename: 'A1.wav', url: libraryAssetUrl('breaks/A1.wav') },
  {
    id: 'chop-sample-2',
    label: '2',
    filename: 'aalonbutler-gettinsoul.wav',
    url: libraryAssetUrl('breaks/aalonbutler-gettinsoul.wav'),
  },
  { id: 'chop-sample-3', label: '3', filename: 'bigjullien-talk.wav', url: libraryAssetUrl('breaks/bigjullien-talk.wav') },
  {
    id: 'chop-sample-4',
    label: '4',
    filename: 'bis-godsavethequeen1.wav',
    url: libraryAssetUrl('breaks/bis-godsavethequeen1.wav'),
  },
]
