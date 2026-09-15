/**
 * @file
 *
 * Spellchecks markdown that is still in memory, with the repository's own `spellcheck` configuration.
 *
 * The sibling of `markdownlint-content.ts`, for the other half of the same gap: `spellcheck` can only answer
 * for what is already on disk, so a document composed during a run — the release's changelog being the one
 * that costs a red `main` — is checked by nothing until the next gate. A coined word in a release note lands
 * on the default branch inside the release commit, and the NEXT release aborts in its second preflight step,
 * in a repository nobody was working on.
 *
 * It SHELLS OUT where the markdownlint half calls a library, and the difference has a reason rather than
 * being an oversight. `cspell` does export a CLI-layer `lint(fileGlobs, options, reporter)` that would be the
 * exact analogue of `markdownlint-cli2`'s `main`, but the only way to hand it content that is not on disk is
 * a `stdin://` glob, and its reader is `streamConsumers.text(process.stdin)` — the HOST process's own stdin,
 * which the release's interactive review also uses. Reaching for it in-process would mean monkey-patching
 * `process.stdin` for the whole process, so the content goes to a child's stdin instead.
 *
 * The `stdin://<path>` form is what makes the check the repository's own rather than a generic one: the
 * virtual document is attributed to a REAL path, so `cspell.json` beside it — its `words`, its dictionaries,
 * its `ignorePaths` — resolves exactly as it would for the written file. A temp file outside the repository
 * would lose all of that, which is why it is not used.
 */

import { getLibDebugger } from '../../debug.ts';
import { toPosixPath } from '../../path.ts';
import { resolveToolCommand } from '../package-manager.ts';
import { execFromRoot } from '../root.ts';

/**
 * The exit code `cspell` returns when it reported nothing.
 */
const SUCCESS_EXIT_CODE = 0;

/**
 * Parameters for {@link spellcheckContent}.
 */
export interface SpellcheckContentParams {
  /**
   * The content to spellcheck.
   */
  readonly content: string;

  /**
   * The path the content is checked AS — normally the path it is about to be written to. It decides which
   * `cspell` configuration applies, and it is what every reported finding is named after.
   */
  readonly filePath: string;
}

/**
 * Spellchecks content that is not on disk, with the configuration `spellcheck` would have used for it.
 *
 * @param params - The {@link SpellcheckContentParams}.
 * @returns A {@link Promise} that resolves to the findings, each one the line the `spellcheck` output would
 * have carried — `<path>:<line>:<column> - Unknown word (<word>)` — or an empty array when there are none.
 */
export async function spellcheckContent(params: SpellcheckContentParams): Promise<string[]> {
  const { content, filePath } = params;
  const contentDebugger = getLibDebugger('cspell:spellcheckContent');

  const result = await execFromRoot([
    ...resolveToolCommand({ tool: 'cspell' }),
    'lint',
    '--no-progress',
    '--no-must-find-files',
    // The `CSpell: Files checked: …` summary and the color codes are both noise in a finding that ends up
    // quoted in an error message, and both are printed by default when they are not asked away.
    '--no-summary',
    '--no-color',
    // A POSIX path, because this is parsed as a URL: a Windows path's backslashes do not survive that.
    `stdin://${toPosixPath(filePath)}`
  ], {
    isQuiet: true,
    shouldIgnoreExitCode: true,
    shouldIncludeDetails: true,
    stdin: content
  });

  contentDebugger(result.stderr);

  if (result.exitCode === SUCCESS_EXIT_CODE) {
    return [];
  }

  const findings = result.stdout.split('\n').map((line) => line.trim()).filter(Boolean);

  // A non-zero exit with nothing reported is `cspell` itself failing — an unreadable configuration, a missing
  // dictionary, a binary that would not start. Returning `[]` there would read as a clean document and let the
  // very thing this module exists to catch through, so it fails loudly and hands over what the tool said.
  if (findings.length === 0) {
    throw new Error(`\`cspell\` exited with ${String(result.exitCode)} without reporting anything:\n${result.stderr}`);
  }

  return findings;
}
