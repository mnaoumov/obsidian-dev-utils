/**
 * @file
 *
 * Contains utility functions for regular expressions.
 */

import {
  assert,
  assertNever,
  ensureNonNullable
} from './type-guards.ts';

/**
 * A strategy to use when merging multiple regex flags into one alternation.
 */
export enum RegExpMergeFlagsConflictStrategy {
  /**
   * Keep only the flags present in all regexes.
   */
  Intersect = 'Intersect',
  /**
   * Throw an error if the regexes have conflicting flags.
   */
  Throw = 'Throw',
  /**
   * Keep only the flags present in any regex.
   */
  Union = 'Union'
}

/**
 * Escapes special characters in a string to safely use it within a regular expression.
 *
 * @param str - The string to escape.
 * @returns The escaped string with special characters prefixed with a backslash.
 */
export function escapeRegExp(str: string): string {
  // NOTE: We can't use `replaceAll()` from `String.ts` here because it introduces a circular dependency.
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Reads a mandatory named capture group from a regex match.
 *
 * Use this for a named group that is ALWAYS present when the pattern matches — not wrapped in an optional
 * `(?:…)?` / `(…)?`. Returns the captured string (which may be `''` for a zero-width match such as `\w*`),
 * throwing if the group — or the match's `groups` object — is absent, so a pattern change that drops the
 * group fails loudly instead of silently yielding a wrong value.
 *
 * Prefer this over `match.groups?.[name] ?? ''`: for a mandatory group that fallback is a never-taken (dead)
 * branch that fails a 100%-branch coverage gate, whereas the throw here lives inside `ensureNonNullable`
 * (already covered), leaving no inline branch at the call site. For a group that may legitimately be absent,
 * use {@link getOptionalNamedGroup} and default its `null` with `?? …`.
 *
 * @param match - The match returned by `RegExp.exec`, `String.matchAll`, or `String.match`.
 * @param groupName - The name of the capture group to read.
 * @returns The captured string.
 * @throws When the named group is absent.
 */
export function getMandatoryNamedGroup(match: RegExpMatchArray, groupName: string): string {
  return ensureNonNullable(getOptionalNamedGroup(match, groupName));
}

/**
 * Reads an optional named capture group from a regex match, distinguishing an absent group from a present
 * empty one.
 *
 * Returns the captured string when the group participated in the match — which may be `''` for a zero-width
 * match such as `\w*` — or `null` when the group, or the match's `groups` object, is absent (e.g. an optional
 * `(?:…)?` group that did not match). Because `null` is returned only for a genuinely-absent group, a
 * caller's `?? <default>` is a live branch rather than the dead one that `match.groups?.[name] ?? ''` leaves
 * for a mandatory group. For a group that must always be present, use {@link getMandatoryNamedGroup}.
 *
 * @param match - The match returned by `RegExp.exec`, `String.matchAll`, or `String.match`.
 * @param groupName - The name of the capture group to read.
 * @returns The captured string, or `null` when the group is absent.
 */
export function getOptionalNamedGroup(match: RegExpMatchArray, groupName: string): null | string {
  return match.groups?.[groupName] ?? null;
}

/**
 * Checks if a string is a valid regular expression.
 *
 * @param str - The string to check.
 * @returns `true` if the string is a valid regular expression, `false` otherwise.
 */
export function isValidRegExp(str: string): boolean {
  try {
    new RegExp(str);
    return true;
  } catch {
    return false;
  }
}

function hasFlag(regExp: RegExp, flag: string): boolean {
  return regExp.flags.includes(flag);
}

/**
 * A regular expression that always matches.
 */
export const ALWAYS_MATCH_REG_EXP = /(?:)/;

/**
 * A regular expression that never matches.
 */
export const NEVER_MATCH_REG_EXP = /.^/;

/**
 * Merges the flags of multiple regexes into a single flag string, applying a conflict strategy.
 *
 * The cooperating per-flag helpers share the same regexes, strategy, and accumulated flag set, so
 * they are grouped here as methods over those fields rather than threading the state through
 * positional arguments.
 */
class RegExpFlagMerger {
  private readonly finalFlags = new Set<string>();

  /**
   * Creates a new merger.
   *
   * @param regExps - The regexes whose flags are merged.
   * @param strategy - The strategy to use when flags conflict.
   */
  public constructor(private readonly regExps: RegExp[], private readonly strategy: RegExpMergeFlagsConflictStrategy) {}

  /**
   * Computes the merged flag string for the configured regexes.
   *
   * @returns The merged flags joined into a single string.
   */
  public computeFlags(): string {
    this.addSemanticFlags();
    this.addUnicodeFlags();
    this.addMetaFlags();
    return [...this.finalFlags].join('');
  }

  private addMetaFlags(): void {
    const META_FLAGS = ['g', 'd'];
    for (const flag of META_FLAGS) {
      if (this.regExps.some((regExp) => hasFlag(regExp, flag))) {
        this.finalFlags.add(flag);
      }
    }
  }

  private addSemanticFlags(): void {
    const SEMANTIC_FLAGS = ['i', 'm', 's', 'y'];
    for (const flag of SEMANTIC_FLAGS) {
      if (this.shouldPickFlag(flag)) {
        this.finalFlags.add(flag);
      }
    }
  }

  private addUnicodeFlags(): void {
    const countU = this.regExps.filter((regExp) => hasFlag(regExp, 'u')).length;
    const countV = this.regExps.filter((regExp) => hasFlag(regExp, 'v')).length;

    let shouldUseUFlag: boolean;
    let shouldUseVFlag: boolean;

    /* v8 ignore start -- v8 counts the implicit default branch as uncovered even when all enum cases are handled. */
    switch (this.strategy) {
      /* v8 ignore stop */
      case RegExpMergeFlagsConflictStrategy.Intersect:
        shouldUseUFlag = countU === this.regExps.length;
        shouldUseVFlag = countV === this.regExps.length;
        break;
      case RegExpMergeFlagsConflictStrategy.Throw: {
        const allU = countU === this.regExps.length;
        const noneU = countU === 0;
        const allV = countV === this.regExps.length;
        const noneV = countV === 0;

        if (!(allU || noneU) || !(allV || noneV)) {
          throw new Error('Conflicting \'u\'/\'v\' flags across patterns.');
        }

        shouldUseUFlag = allU;
        shouldUseVFlag = allV;
        break;
      }
      case RegExpMergeFlagsConflictStrategy.Union:
        shouldUseUFlag = countU > 0;
        shouldUseVFlag = countV > 0;
        break;
      default:
        /* v8 ignore start -- Exhaustive switch guard. */
        assertNever(this.strategy);
        /* v8 ignore stop */
    }

    if (shouldUseUFlag && shouldUseVFlag) {
      assert(this.strategy !== RegExpMergeFlagsConflictStrategy.Throw, 'Cannot combine both \'u\'/\'v\' flags in one RegExp.');
      shouldUseUFlag = false;
    }

    if (shouldUseUFlag) {
      this.finalFlags.add('u');
    }
    if (shouldUseVFlag) {
      this.finalFlags.add('v');
    }
  }

  private shouldPickFlag(flag: string): boolean {
    const count = this.regExps.filter((regExp) => hasFlag(regExp, flag)).length;
    /* v8 ignore start -- v8 counts the implicit default branch as uncovered even when all enum cases are handled. */
    switch (this.strategy) {
      /* v8 ignore stop */
      case RegExpMergeFlagsConflictStrategy.Intersect:
        return count === this.regExps.length;
      case RegExpMergeFlagsConflictStrategy.Throw:
        break;
      case RegExpMergeFlagsConflictStrategy.Union:
        return count > 0;
      default:
        /* v8 ignore start -- Exhaustive switch guard. */
        assertNever(this.strategy);
        /* v8 ignore stop */
    }

    const allSame = count === 0 || count === this.regExps.length;
    if (!allSame) {
      throw new Error(`Conflicting flag '${flag}' across patterns.`);
    }
    return count === this.regExps.length;
  }
}

/**
 * Combine multiple regexes into one alternation, handling flags.
 *
 * @param regExps - The regexes to combine.
 * @param strategy - The strategy to use when merging flags (default: `RegExpMergeFlagsConflictStrategy.Throw`).
 * @returns The combined regex.
 */
export function oneOf(
  regExps: RegExp[],
  strategy: RegExpMergeFlagsConflictStrategy = RegExpMergeFlagsConflictStrategy.Throw
): RegExp {
  if (regExps.length === 0) {
    return ALWAYS_MATCH_REG_EXP;
  }

  if (regExps.length === 1 && regExps[0] !== undefined) {
    return regExps[0];
  }

  const source = regExps.map((regExp) => `(?:${regExp.source})`).join('|');
  const flags = new RegExpFlagMerger(regExps, strategy).computeFlags();
  return new RegExp(source, flags);
}
