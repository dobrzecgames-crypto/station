export type LibraryCategory = 'KICK' | 'SNARE' | 'HAT' | 'SOUND'

export interface LibrarySample {
  id: string
  category: LibraryCategory
  filename: string
  url: string
}

export const libraryCategories: readonly LibraryCategory[] = ['KICK', 'SNARE', 'HAT', 'SOUND']

export const builtInLibrary: readonly LibrarySample[] = [
  { id: 'kick-01', category: 'KICK', filename: 'Kick 01.wav', url: '/library/kick-01.wav' },
  { id: 'kick-02', category: 'KICK', filename: 'Kick 02.wav', url: '/library/kick-02.wav' },
  { id: 'kick-03', category: 'KICK', filename: 'Kick 03.wav', url: '/library/kick-03.wav' },
  { id: 'kick-04', category: 'KICK', filename: 'Kick 04.wav', url: '/library/kick-04.wav' },
  { id: 'snare-01', category: 'SNARE', filename: 'Snare 01.wav', url: '/library/snare-01.wav' },
  { id: 'snare-02', category: 'SNARE', filename: 'Snare 02.wav', url: '/library/snare-02.wav' },
  { id: 'snare-03', category: 'SNARE', filename: 'Snare 03.wav', url: '/library/snare-03.wav' },
  { id: 'snare-04', category: 'SNARE', filename: 'Snare 04.wav', url: '/library/snare-04.wav' },
  { id: 'hat-01', category: 'HAT', filename: 'Hat 01.wav', url: '/library/hat-01.wav' },
  { id: 'hat-02', category: 'HAT', filename: 'Hat 02.wav', url: '/library/hat-02.wav' },
  { id: 'hat-03', category: 'HAT', filename: 'Hat 03.wav', url: '/library/hat-03.wav' },
  { id: 'hat-04', category: 'HAT', filename: 'Hat 04.wav', url: '/library/hat-04.wav' },
  { id: 'piano-c5', category: 'SOUND', filename: 'Piano C5.wav', url: '/library/piano-c5.wav' },
  { id: 'pluck-c5', category: 'SOUND', filename: 'Pluck C5.wav', url: '/library/pluck-c5.wav' },
  { id: 'saw-c5', category: 'SOUND', filename: 'Saw C5.wav', url: '/library/saw-c5.wav' },
  { id: 'synth-c5', category: 'SOUND', filename: 'Synth C5.wav', url: '/library/synth-c5.wav' },
]
