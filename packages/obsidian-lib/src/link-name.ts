/**
 * @file
 *
 * The one definition of when two link names — a note's basename, or one of its aliases — name the same
 * note.
 */

/**
 * Normalizes a link name for comparison: lowercased, with every run of two or more spaces collapsed into
 * one.
 *
 * Obsidian treats `[[some  alias]]` and `[[Some Alias]]` as naming the same note, so a lookup that
 * resolves a wikilink by basename or alias has to compare in this space. Every plugin answering that
 * question must use this function rather than a copy of it: two copies that disagree do not fail a build
 * or a test, they make the same link resolve to a different note depending on which plugins are
 * installed.
 *
 * Only the space character is collapsed. Tabs and other whitespace are kept as they are.
 *
 * @param name - The raw basename or alias.
 * @returns The name in normalized space.
 */
export function normalizeLinkName(name: string): string {
  return name.toLowerCase().replaceAll(/ {2,}/g, ' ');
}
