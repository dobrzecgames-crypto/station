/** Resolves public library files against Vite's configured base path.
 * Development uses `/`, while the portfolio deploys Station under `/station/`.
 */
export function libraryAssetUrl(filename: string): string {
  return `${import.meta.env.BASE_URL}library/${filename}`
}
