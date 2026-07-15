/**
 * @file
 *
 * Detects export names that collide case-insensitively within a namespace.
 *
 * The documentation site emits one filesystem directory per (namespace, export), so two exports in
 * the same namespace whose names differ only in case (e.g. `TypeAsserter` and `typeAsserter`)
 * overwrite each other when the site is built on a case-insensitive filesystem (Windows/macOS),
 * silently dropping a page and 404-ing every link to it. The build fails fast on such a pair so it
 * is renamed at the source rather than discovered as a broken production link.
 */

/**
 * A group of export names in one namespace that collapse to the same case-insensitive key.
 */
export interface ExportNameCollision {
  /**
   * The distinct colliding export names, sorted.
   */
  names: string[];

  /**
   * The namespace (module specifier) the colliding names share.
   */
  namespace: string;
}

/**
 * Finds export names that collide case-insensitively within each namespace.
 *
 * @param namesByNamespace - The export names grouped by namespace. Exact-duplicate names within a
 *   namespace (declaration merging) are not a collision and are ignored.
 * @returns One entry per colliding group, in namespace-then-key iteration order.
 */
export function findExportNameCollisions(namesByNamespace: Map<string, string[]>): ExportNameCollision[] {
  const collisions: ExportNameCollision[] = [];

  for (const [namespace, names] of namesByNamespace) {
    const namesByLowerKey = new Map<string, Set<string>>();
    for (const name of names) {
      const lowerKey = name.toLowerCase();
      const group = namesByLowerKey.get(lowerKey) ?? new Set<string>();
      group.add(name);
      namesByLowerKey.set(lowerKey, group);
    }

    for (const group of namesByLowerKey.values()) {
      if (group.size > 1) {
        collisions.push({ names: [...group].sort(), namespace });
      }
    }
  }

  return collisions;
}

/**
 * Formats collisions into a human-readable multi-line report.
 *
 * @param collisions - The collisions to describe.
 * @returns One line per colliding group.
 */
export function formatExportNameCollisions(collisions: ExportNameCollision[]): string {
  return collisions.map((collision) => `  ${collision.namespace}: ${collision.names.join(' vs ')}`).join('\n');
}
