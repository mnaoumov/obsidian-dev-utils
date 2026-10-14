/**
 * @file
 *
 * The `property:name` / `property:name=value` entry syntax shared by the settings lists that can match a note by its frontmatter.
 *
 * Two lists read it today: note priorities (`findNotePriorityRank`) and the attachment extensions of `isTreatedAsAttachment`.
 * Both match through the one function here, so an entry the user writes in one list means exactly the same thing in the other.
 */

/**
 * The prefix that marks a settings entry as a frontmatter property match.
 */
export const PROPERTY_ENTRY_PREFIX = 'property:';

const PROPERTY_VALUE_SEPARATOR = '=';

/**
 * Parameters for {@link checkPropertyEntryMatches}.
 */
export interface CheckPropertyEntryMatchesParams {
  /**
   * The entry to match: `property:name` matches when the property is present, `property:name=value` when it renders as `value`.
   */
  readonly entry: string;

  /**
   * The note's frontmatter, or `null` when it has none or it is not known.
   */
  readonly frontmatter: null | Readonly<Record<string, unknown>>;
}

/**
 * Checks whether a note's frontmatter matches a `property:name` or `property:name=value` entry.
 *
 * A value is compared by its rendering, since frontmatter values are whatever YAML produced, and an array matches when any of its items does,
 * which is how tag-like properties read. An entry without the {@link PROPERTY_ENTRY_PREFIX} matches nothing.
 *
 * @param params - The entry and the frontmatter to match it against.
 * @returns Whether the frontmatter matches the entry.
 */
export function checkPropertyEntryMatches(params: CheckPropertyEntryMatchesParams): boolean {
  const {
    entry,
    frontmatter
  } = params;
  if (!frontmatter || !isPropertyEntry(entry)) {
    return false;
  }

  const specifier = entry.slice(PROPERTY_ENTRY_PREFIX.length);
  const separatorIndex = specifier.indexOf(PROPERTY_VALUE_SEPARATOR);
  if (separatorIndex === -1) {
    return Object.hasOwn(frontmatter, specifier);
  }

  const propertyName = specifier.slice(0, separatorIndex);
  const expectedValue = specifier.slice(separatorIndex + 1);
  if (!Object.hasOwn(frontmatter, propertyName)) {
    return false;
  }

  const actualValue = frontmatter[propertyName];
  return Array.isArray(actualValue) ? actualValue.some((item) => String(item) === expectedValue) : String(actualValue) === expectedValue;
}

/**
 * Checks whether a settings entry is a frontmatter property match.
 *
 * @param entry - The entry to check.
 * @returns Whether the entry starts with {@link PROPERTY_ENTRY_PREFIX}.
 */
export function isPropertyEntry(entry: string): boolean {
  return entry.startsWith(PROPERTY_ENTRY_PREFIX);
}
