/**
 * @file
 *
 * Lints markdown that is still in memory, with the repository's own `lint:md` configuration.
 *
 * `lint:md` can only answer for what is already on disk, which leaves every document composed during a run
 * unchecked until the next gate — the release's changelog being the one that costs a red `main`. This module
 * is the same check one step earlier: the text is linted as the path it is destined for, and a caller that
 * does not like the answer can stop before writing anything.
 *
 * It goes through `markdownlint-cli2` rather than `markdownlint`'s own string API, and that is the whole
 * point of the module. The question a caller is asking is *"would `lint:md` have failed on this text?"*, and
 * only the `markdownlint-cli2` layer knows: it is what finds `.markdownlint-cli2.mjs` (through `jiti`, for
 * the TypeScript configuration this workspace writes), merges the repository's own overrides over the shared
 * defaults, and loads the custom rules. Reaching for the string API means hand-rolling that resolution over
 * five configuration file formats, which is a copy of `markdownlint-cli2` that can only ever drift from it.
 */

import { main as markdownlintCli2 } from 'markdownlint-cli2';

import { getLibDebugger } from '../../debug.ts';
import { toPosixPath } from '../../path.ts';
import { getRootFolder } from '../root.ts';
import { obsidianDevUtilsConfig } from './markdownlint-cli2-config.ts';

/**
 * The exit code `markdownlint-cli2` returns when it reported nothing that counts as a failure.
 */
const SUCCESS_EXIT_CODE = 0;

/**
 * Parameters for {@link lintMarkdownContent}.
 */
export interface LintMarkdownContentParams {
  /**
   * The markdown to lint.
   */
  readonly content: string;

  /**
   * The path the content is linted AS — normally the path it is about to be written to. It decides how the
   * path-relative rules resolve (`relative-links` walks from the file's own folder), and it is what every
   * reported finding is named after.
   */
  readonly filePath: string;
}

/**
 * Lints markdown content that is not on disk, with the configuration `lint:md` would have used for it.
 *
 * @param params - The {@link LintMarkdownContentParams}.
 * @returns A {@link Promise} that resolves to the findings, each one the line the `lint:md` output would have
 * carried — `<path>:<line>[:<column>] error <rule> <description>` — or an empty array when there are none.
 */
export async function lintMarkdownContent(params: LintMarkdownContentParams): Promise<string[]> {
  const { content, filePath } = params;
  const findings: string[] = [];
  const contentDebugger = getLibDebugger('markdownlint:lintMarkdownContent');

  const exitCode = await markdownlintCli2({
    directory: getRootFolder() ?? process.cwd(),
    logError: (message: string): void => {
      findings.push(message);
    },
    logMessage: (message: string): void => {
      contentDebugger(message);
    },
    // The content is the only input. Without this the configuration's own `globs` would be expanded too, and
    // a check on one document would lint the whole repository — slowly, and reporting findings its caller has
    // no business failing on.
    noGlobs: true,
    nonFileContents: { [toPosixPath(filePath)]: content },
    // The BASE the repository's own configuration is merged over, which matters for a repository that has none
    // yet: `lint()` copies the template configuration in — which is built on this one — before it lints, so a
    // run without it would apply markdownlint's stock defaults instead, and `MD013/line-length` would fail at
    // 80 columns on an ordinary release note that `lint:md` is perfectly happy with. Since a repository's own
    // configuration overrides this key by key, the worst a mismatch can do is miss a finding, never invent one.
    optionsDefault: obsidianDevUtilsConfig
  });

  // Whether this is a FAILURE is the tool's own answer, not a count of the lines it printed: a rule configured
  // with `severity: warning` is printed through `logError` like any other and still exits `0`, so returning the
  // lines alone would fail a release on something `lint:md` itself passes.
  return exitCode === SUCCESS_EXIT_CODE ? [] : findings;
}
