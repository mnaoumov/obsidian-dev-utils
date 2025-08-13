/**
 * @packageDocumentation
 *
 * Contains utility functions for regular expressions.
 */

/**
 * The strategy to use when merging multiple regex flags into one alternation.
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

function shouldPickFlag(regExps: RegExp[], flag: string, strategy: RegExpMergeFlagsConflictStrategy): boolean {
  const count = regExps.filter((regExp) => hasFlag(regExp, flag)).length;
  switch (strategy) {
    case RegExpMergeFlagsConflictStrategy.Intersect:
      return count === regExps.length;
    case RegExpMergeFlagsConflictStrategy.Throw:
      break;
    case RegExpMergeFlagsConflictStrategy.Union:
      return count > 0;
    default:
      throw new Error(`Invalid strategy: ${strategy as string}`);
  }

  const allSame = count === 0 || count === regExps.length;
  if (!allSame) {
    throw new Error(`Conflicting flag '${flag}' across patterns.`);
  }
  return count === regExps.length;
}

/**
 * The regex that always matches.
 */
export const ALWAYS_MATCH_REG_EXP = /(?:)/;

/**
 * The regex that never matches.
 */
export const NEVER_MATCH_REG_EXP = /.^/;

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

  const finalFlags = new Set<string>();
  addSemanticFlags(finalFlags, regExps, strategy);
  addUnicodeFlags(finalFlags, regExps, strategy);
  addMetaFlags(finalFlags, regExps);

  return new RegExp(source, [...finalFlags].join(''));
}

function addMetaFlags(finalFlags: Set<string>, regExps: RegExp[]): void {
  const META_FLAGS = ['g', 'd'];
  for (const flag of META_FLAGS) {
    if (regExps.some((regExp) => hasFlag(regExp, flag))) {
      finalFlags.add(flag);
    }
  }
}

function addSemanticFlags(
  finalFlags: Set<string>,
  regExps: RegExp[],
  strategy: RegExpMergeFlagsConflictStrategy
): void {
  const SEMANTIC_FLAGS = ['i', 'm', 's', 'y'];
  for (const flag of SEMANTIC_FLAGS) {
    if (shouldPickFlag(regExps, flag, strategy)) {
      finalFlags.add(flag);
    }
  }
}

function addUnicodeFlags(
  finalFlags: Set<string>,
  regExps: RegExp[],
  strategy: RegExpMergeFlagsConflictStrategy
): void {
  const countU = regExps.filter((regExp) => hasFlag(regExp, 'u')).length;
  const countV = regExps.filter((regExp) => hasFlag(regExp, 'v')).length;

  let shouldUseUFlag: boolean;
  let shouldUseVFlag: boolean;

  switch (strategy) {
    case RegExpMergeFlagsConflictStrategy.Intersect:
      shouldUseUFlag = countU === regExps.length;
      shouldUseVFlag = countV === regExps.length;
      break;
    case RegExpMergeFlagsConflictStrategy.Throw: {
      const allU = countU === regExps.length;
      const noneU = countU === 0;
      const allV = countV === regExps.length;
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
      throw new Error(`Invalid strategy: ${strategy as string}`);
  }

  if (shouldUseUFlag && shouldUseVFlag) {
    if (strategy === RegExpMergeFlagsConflictStrategy.Throw) {
      throw new Error('Cannot combine both \'u\'/\'v\' flags in one RegExp.');
    }
    shouldUseUFlag = false;
  }

  if (shouldUseUFlag) {
    finalFlags.add('u');
  }
  if (shouldUseVFlag) {
    finalFlags.add('v');
  }
}
