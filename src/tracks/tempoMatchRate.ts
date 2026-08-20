/**
 * Rate-based tempo match (DEC-008 rules out real time-stretching): when
 * tempoMatch is on and a source tempo is known, playback rate is scaled by
 * projectBpm/detectedSourceBpm on top of pitchSemitones, so it changes pitch
 * too. Kept separate so live and offline clip scheduling share the exact
 * conversion without importing the rest of the TRACKS editing operations.
 */
export function resolveTempoMatchRate(tempoMatch: boolean, detectedSourceBpm: number | null, projectBpm: number): number {
  if (!tempoMatch || !detectedSourceBpm || detectedSourceBpm <= 0) return 1
  return projectBpm / detectedSourceBpm
}
