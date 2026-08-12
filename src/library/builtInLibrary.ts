import { libraryAssetUrl } from './libraryAssetUrl'

export type LibraryCategory = 'KICK' | 'SNARE' | 'HAT' | 'SOUND' | 'BREAKS'

export interface LibrarySample {
  id: string
  category: LibraryCategory
  filename: string
  url: string
}

export const libraryCategories: readonly LibraryCategory[] = ['KICK', 'SNARE', 'HAT', 'SOUND', 'BREAKS']

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

function numberedDrumSamples(
  category: Extract<LibraryCategory, 'KICK' | 'SNARE' | 'HAT'>,
  count: number,
): LibrarySample[] {
  const prefix = category.toLowerCase()

  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(2, '0')
    const id = `${prefix}-${number}`
    const filename = `${category[0]}${category.slice(1).toLowerCase()} ${number}.wav`

    return {
      id,
      category,
      filename,
      url: libraryAssetUrl(`${id}.wav`),
    }
  })
}

function samplePack(
  category: Extract<LibraryCategory, 'KICK' | 'SNARE' | 'HAT'>,
  idPrefix: string,
  label: string,
  count: number,
): LibrarySample[] {
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(3, '0')
    const id = `${idPrefix}-${number}`

    return {
      id,
      category,
      filename: `${label} ${number}.wav`,
      url: libraryAssetUrl(`${id}.wav`),
    }
  })
}

export const builtInLibrary: readonly LibrarySample[] = [
  ...numberedDrumSamples('KICK', 12),
  ...samplePack('KICK', 'top-kick', 'Top Kick', 107),
  ...numberedDrumSamples('SNARE', 18),
  ...samplePack('SNARE', 'avr-snare', 'AVR Snare', 25),
  ...numberedDrumSamples('HAT', 16),
  ...samplePack('HAT', 'avr-closed-hat', 'AVR Closed Hat', 20),
  ...samplePack('HAT', 'avr-open-hat', 'AVR Open Hat', 30),
  ...samplePack('HAT', 'avr-shaker', 'AVR Shaker', 15),
  ...samplePack('HAT', 'avr-tambourine', 'AVR Tambourine', 5),
  { id: 'piano-c5', category: 'SOUND', filename: 'Piano C5.wav', url: libraryAssetUrl('piano-c5.wav') },
  { id: 'pluck-c5', category: 'SOUND', filename: 'Pluck C5.wav', url: libraryAssetUrl('pluck-c5.wav') },
  { id: 'saw-c5', category: 'SOUND', filename: 'Saw C5.wav', url: libraryAssetUrl('saw-c5.wav') },
  { id: 'synth-c5', category: 'SOUND', filename: 'Synth C5.wav', url: libraryAssetUrl('synth-c5.wav') },
  ...breakFilenames.map((filename) => ({
    id: `break-${filename.replace(/\.wav$/i, '')}`,
    category: 'BREAKS' as const,
    filename,
    url: libraryAssetUrl(`breaks/${filename}`),
  })),
]
