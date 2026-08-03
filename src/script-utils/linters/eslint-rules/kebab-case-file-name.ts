/**
 * @file
 *
 * ESLint rule: kebab-case-file-name
 *
 * Reports an error when a linted file's name is not kebab-case.
 *
 * Only the **stem** is checked — everything before the first dot — so every suffix combination this
 * codebase uses is handled without listing any of them: `foo.ts`, `foo.test.ts`,
 * `foo.obsidian.integration.test.ts`, `foo.d.ts` and `foo.config.ts` all reduce to `foo`.
 *
 * The rule takes **no options**. A directory with a deliberately different convention is exempted where
 * ESLint already expresses that — an `ignores` entry in the flat config — rather than through a rule
 * option that would have to be threaded through every consumer. The three such cases in this workspace
 * are all naming-mirrors, not drift: `obsidian-test-mocks` and `obsidian-typings` mirror Obsidian's own
 * export names (`App.ts`, `Vault.ts`, `createDiv.ts`), and this repository's
 * `eslint-types/@types/` shims mirror upstream PACKAGE names, which contain characters kebab-case cannot
 * express at all.
 */
import type { Rule } from 'eslint';

import { ensureNonNullable } from '../../../type-guards.ts';

/** Message ID reported when a file name is not kebab-case. */
export const MESSAGE_ID = 'kebabCaseFileName';

/**
 * Lowercase alphanumeric groups joined by single hyphens. Deliberately strict: it rejects leading and
 * trailing hyphens, doubled hyphens, underscores, and any uppercase letter.
 */
const KEBAB_CASE_REG_EXP = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Separates a path into its segments, accepting both separators so Windows paths work unchanged. */
const PATH_SEPARATOR_REG_EXP = /[/\\]/;

export const kebabCaseFileName: Rule.RuleModule = {
  create(context) {
    return {
      Program(node): void {
        const stem = getFileNameStem(context.filename);

        // `<input>` / `<text>` — ESLint's placeholder when linting a string rather than a file, which has
        // No name to judge.
        if (stem === '' || stem.startsWith('<')) {
          return;
        }

        if (KEBAB_CASE_REG_EXP.test(stem)) {
          return;
        }

        context.report({
          data: { name: stem },
          messageId: MESSAGE_ID,
          node
        });
      }
    };
  },
  meta: {
    docs: {
      description: 'Require file names to be kebab-case.'
    },
    messages: {
      [MESSAGE_ID]: 'File name "{{name}}" is not kebab-case. Rename it to lowercase words joined by single hyphens.'
    },
    schema: [],
    type: 'suggestion'
  }
};

/**
 * Extracts the part of a path's file name that must be kebab-case.
 *
 * A LEADING dot belongs to the dotfile convention rather than to the name, so it is stripped before the
 * stem is taken: `.markdownlint-cli2.mjs` is judged as `markdownlint-cli2`, which is a real name that can
 * be got wrong, rather than skipped as if it had no name at all.
 *
 * @param filename - The absolute or relative path ESLint is linting.
 * @returns The file name up to its first dot, with any leading dot removed.
 */
function getFileNameStem(filename: string): string {
  const segments = filename.split(PATH_SEPARATOR_REG_EXP);
  // `String.split` always yields at least one element, so both reads below exist for ANY input,
  // Including `''`. They are asserted rather than defaulted so no unreachable fallback branch is
  // Introduced — the empty name is already handled by the caller's `stem === ''` guard.
  const baseName = ensureNonNullable(segments.at(-1));
  const nameWithoutLeadingDot = baseName.startsWith('.') ? baseName.slice(1) : baseName;
  return ensureNonNullable(nameWithoutLeadingDot.split('.', 1)[0]);
}
