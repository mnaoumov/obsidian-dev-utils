/**
 * @file
 *
 * An UNPUBLISHED list of patterns that a release must never publish, read from a file the repository does not
 * contain.
 *
 * The list exists for vocabulary that is private to one maintainer's machine — an internal tracker's ids, the
 * short names of their projects — and which a commit subject can carry straight into a generated changelog
 * section. Neither of the two obvious homes works for it: a literal in this library would ship the list to every
 * consumer on npm, and a checked-in per-repository config would publish it in every public repository that used
 * it, permanently. So the list is named by the {@link FORBIDDEN_PATTERNS_FILE_ENV_VARIABLE} environment variable
 * (which a gitignored `.env` can set), points at a file outside the repository, and is a no-op wherever it is not
 * set — a consumer who has not configured it sees no change at all.
 *
 * The file holds one pattern per line. Blank lines and lines starting with `#` are ignored. A line written as a
 * regular expression literal — `/\bfoo\b/i` — takes the flags it names; any other line is a case-sensitive
 * regular expression source. The global and sticky flags are dropped, since a match here is a yes/no question
 * asked of one line at a time.
 */

import { readFile } from 'node:fs/promises';
import process from 'node:process';

import { ensureNonNullable } from '../type-guards.ts';
import { loadEnvFileIfExists } from './env-toggle.ts';

/**
 * The environment variable naming the forbidden-patterns file.
 */
export const FORBIDDEN_PATTERNS_FILE_ENV_VARIABLE = 'FORBIDDEN_PATTERNS_FILE';

/**
 * One line of text that a forbidden pattern matched.
 */
export interface ForbiddenPatternMatch {
  /**
   * The line that carries the match.
   */
  readonly line: string;

  /**
   * The text the pattern matched within {@link line}.
   */
  readonly match: string;
}

const REG_EXP_LITERAL_REG_EXP = /^\/(?<source>.+)\/(?<flags>[a-z]*)$/;
const STATEFUL_FLAGS_REG_EXP = /[gy]/g;

/**
 * Finds every line of `text` that one of `patterns` matches.
 *
 * @param text - The text to scan, line by line.
 * @param patterns - The patterns, as {@link readForbiddenPatterns} returned them.
 * @returns One {@link ForbiddenPatternMatch} per offending line, naming the first pattern that matched it.
 */
export function findForbiddenPatternMatches(text: string, patterns: readonly RegExp[]): ForbiddenPatternMatch[] {
  const matches: ForbiddenPatternMatch[] = [];

  for (const line of text.split(/\r?\n/)) {
    for (const pattern of patterns) {
      const match = pattern.exec(line);
      if (match) {
        matches.push({ line, match: match[0] });
        break;
      }
    }
  }

  return matches;
}

/**
 * Reads the forbidden patterns from the file {@link FORBIDDEN_PATTERNS_FILE_ENV_VARIABLE} names, loading the
 * optional `.env` first.
 *
 * An unset or blank variable means no list is configured, and yields no patterns. A variable that IS set but
 * names a file that cannot be read throws instead of yielding none: a guard that switches itself off because
 * its list moved is precisely the silent failure it exists to prevent.
 *
 * @returns A {@link Promise} that resolves to the compiled patterns.
 * @throws If the named file cannot be read, or one of its lines is not a valid regular expression.
 */
export async function readForbiddenPatterns(): Promise<RegExp[]> {
  loadEnvFileIfExists();
  const filePath = (process.env[FORBIDDEN_PATTERNS_FILE_ENV_VARIABLE] ?? '').trim();
  if (filePath === '') {
    return [];
  }

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`${FORBIDDEN_PATTERNS_FILE_ENV_VARIABLE} names ${filePath}, which cannot be read.`, { cause: error });
  }

  const patterns: RegExp[] = [];
  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }

    try {
      patterns.push(toRegExp(line));
    } catch (error) {
      throw new Error(`Line ${String(index + 1)} of the forbidden-patterns file ${filePath} is not a valid regular expression.`, { cause: error });
    }
  }

  return patterns;
}

function toRegExp(line: string): RegExp {
  const groups = REG_EXP_LITERAL_REG_EXP.exec(line)?.groups;
  if (!groups) {
    return new RegExp(line);
  }

  const source = ensureNonNullable(groups['source']);
  const flags = ensureNonNullable(groups['flags']);
  return new RegExp(source, flags.replaceAll(STATEFUL_FLAGS_REG_EXP, ''));
}
