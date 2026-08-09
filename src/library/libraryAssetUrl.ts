/** Resolves public library files against Vite's configured base path. */
export function libraryAssetUrl(filename: string): string {
  return `${import.meta.env.BASE_URL}library/${filename}`
}
