import { libraryAssetUrl } from './libraryAssetUrl'

export type LibraryCategory = 'KICK' | 'SNARE' | 'HAT' | 'BREAKS'

export interface LibrarySample {
  id: string
  category: LibraryCategory
  filename: string
  url: string
}

export const libraryCategories: readonly LibraryCategory[] = ['KICK', 'SNARE', 'HAT', 'BREAKS']

const breakFilenames = [
  'A1.wav',
  'aalonbutler-gettinsoul.wav',
  'bigjullien-talk.wav',
  'bis-godsavethequeen1.wav',
  'bis-godsavethequeen2.wav',
  'chicobatera-oxossi.wav',
  'coldblood-kissingmylove.wav',
  'coldgrits-itsyourthing.wav',
  'drumloop_87.314bpm.wav',
  'drumloopvinyl.wav',
  'fabulouspeps-loveofmylife.wav',
  'fleetwoodmac-hypnotized.wav',
  'harvey-soulandsunshine.wav',
  'indeep-lastnightadjsavedmylife.wav',
  'jakewade-searchingforthesoul.wav',
  'jamesspencer-takethiswomanoffthecorner.wav',
  'jbslatin-spittinimage.wav',
  'jcdavis-anewday.wav',
  'joethomas-mrmumbles.wav',
  'johndankworth-modestyblaise.wav',
  'karelkrautgartner-laserena.wav',
  'ledzeppelin-boogiewithstu.wav',
  'levertallison-sugardaddy.wav',
  'loucourtney-heyjoyce.wav',
  'oh.wav',
  'rogerroger-jerkmachine.wav',
  'royporter-partytime.wav',
  'serguei-ourico.wav',
  'sob-thesoilitilledforyou.wav',
  'soulpatrol-peterpan.wav',
  'themeter-soulisland.wav',
  'themeters-cardova.wav',
  'themeters-groovylady.wav',
  'themeters-jungleman.wav',
  'themeters-sameoldthing.wav',
  'tonitornado-podescreramizado.wav',
  'unknown-vinylbreak1.wav',
  'unknown-vinylbreak2.wav',
  'unknown-vinylbreak3.wav',
  'unknown-vinylbreak4.wav',
  'unknown-vinylbreak5.wav',
  'unknown-vinylbreak7.wav',
  'unknown-vinylbreak8.wav',
  'unknown-vinylbreak9.wav',
  'uschibruning-welcheinzufall.wav',
  'walterbranco-mangowalk.wav',
  'zalatnay-haddmondjamel.wav',
] as const

function sunkenDrumSamples(
  category: Extract<LibraryCategory, 'KICK' | 'SNARE' | 'HAT'>,
  folder: 'kicks' | 'snares' | 'hats',
  sampleNumbers: readonly number[],
): LibrarySample[] {
  const label = category[0] + category.slice(1).toLowerCase()

  return sampleNumbers.map((sampleNumber) => {
    const filename = `1998 - ${label} ${sampleNumber}.wav`
    return {
      id: `sunken11-${category.toLowerCase()}-${String(sampleNumber).padStart(2, '0')}`,
      category,
      filename,
      url: libraryAssetUrl(`${folder}/${filename}`),
    }
  })
}

const sequence = (count: number): number[] => Array.from({ length: count }, (_, index) => index + 1)

export const builtInLibrary: readonly LibrarySample[] = [
  ...sunkenDrumSamples('KICK', 'kicks', sequence(30)),
  ...sunkenDrumSamples('SNARE', 'snares', sequence(32)),
  // The source pack skips Hat 25; listing only real files keeps the browser honest.
  ...sunkenDrumSamples('HAT', 'hats', [...sequence(24), 26, 27]),
  ...breakFilenames.map((filename) => ({
    id: `break-${filename.replace(/\.wav$/i, '')}`,
    category: 'BREAKS' as const,
    filename,
    url: libraryAssetUrl(`breaks/${filename}`),
  })),
]
