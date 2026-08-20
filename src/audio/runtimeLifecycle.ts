/** Removes resources outside the current runtime scope and disposes each
 * removed value exactly once. Useful for project-owned Web Audio registries,
 * whose stable IDs change as projects are opened. */
export function pruneRuntimeMap<Key, Value>(
  resources: Map<Key, Value>,
  retainedKeys: ReadonlySet<Key>,
  dispose?: (value: Value, key: Key) => void,
): number {
  let removed = 0
  for (const [key, value] of resources) {
    if (retainedKeys.has(key)) continue
    dispose?.(value, key)
    resources.delete(key)
    removed += 1
  }
  return removed
}
