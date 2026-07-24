export interface ChopTestSample {
  id: string
  label: string
  filename: string
  url: string
}

export const chopTestSamples: readonly ChopTestSample[] = [
  { id: 'chop-sample-1', label: '1', filename: 'Sample 1.wav', url: '/library/chop-sample-1.wav' },
  { id: 'chop-sample-2', label: '2', filename: 'Sample 2.wav', url: '/library/chop-sample-2.wav' },
  { id: 'chop-sample-3', label: '3', filename: 'Sample 3.wav', url: '/library/chop-sample-3.wav' },
  { id: 'chop-sample-4', label: '4', filename: 'Sample 4.wav', url: '/library/chop-sample-4.wav' },
]
