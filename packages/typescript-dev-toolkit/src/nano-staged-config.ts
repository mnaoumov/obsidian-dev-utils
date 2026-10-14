/**
 * @file
 *
 * Shared nano-staged configuration for pre-commit hooks.
 */

import process from 'node:process';

import {
  isEnvVariableOff,
  loadEnvFileIfExists
} from './env-toggle.ts';
import { getPackageManagerRunCommand } from './package-manager.ts';

/**
 * Options for {@link getNanoStagedConfig}.
 */
export interface GetNanoStagedConfigOptions {
  /**
   * Repo-specific file-rewriting tasks, keyed by the nano-staged pattern that claims their files.
   *
   * Each gets spellcheck appended and its files removed from the spellcheck-only key, exactly like the shared
   * writers. A pattern must not contain `/`, and must not repeat a shared writer pattern.
   */
  readonly additionalWriterTasks?: Readonly<Record<string, readonly string[]>>;
}

/**
 * The `<manager> run` prefix every task below is built on, resolved once for the process.
 *
 * Detection probes for a lockfile beside `package.json`, so it is a handful of `existsSync` calls and
 * nothing more — no `.env` read and no `process.exit`, which is what lets it sit at module scope.
 */
const PACKAGE_MANAGER_RUN_COMMAND = getPackageManagerRunCommand().join(' ');

const SPELLCHECK_COMMAND = `${PACKAGE_MANAGER_RUN_COMMAND} spellcheck --`;

/**
 * The tasks that REWRITE a staged file, keyed by the nano-staged pattern that claims it.
 *
 * `lint:fix` and `format` both rewrite the file, so they have to share one key: nano-staged runs its
 * per-pattern groups under `Promise.all` (`run()` in `nano-staged/lib/cmd-runner.js`), and sequences only
 * the commands INSIDE a single key's array (`runTask()`, a `for ... of await`). Split across two keys they
 * race, whichever finishes last wins, and the commit stages bytes that neither tool would have produced on
 * its own.
 *
 * So do NOT express a directory exclusion by giving one of these two its own negated key -- that silently
 * takes the ordering away. An exclusion belongs in the excluded tool's own config, where ESLint's
 * `globalIgnores` already puts it: a path ESLint ignores is reported as a warning and exits 0 when it is
 * passed explicitly, so it costs a console line rather than a failed commit and needs no key here.
 */
const WRITER_TASKS: Readonly<Record<string, readonly string[]>> = {
  '*.{ts,tsx,mts}': [
    `${PACKAGE_MANAGER_RUN_COMMAND} lint:fix --`,
    `${PACKAGE_MANAGER_RUN_COMMAND} format --`
  ],
  '*.md': [
    `${PACKAGE_MANAGER_RUN_COMMAND} lint:md:fix --`
  ]
};

/**
 * Nano-staged configuration that runs file-based lint, format, and spellcheck on staged files.
 *
 * Only includes tools that can operate on individual files. Whole-project checks
 * (TypeScript compilation, unit tests) are left to CI.
 *
 * Commands run through the package manager that owns the tree — `npm run ... --`, `bun run ... --`, and
 * so on — so nano-staged file paths are forwarded as CLI arguments.
 *
 * Spellcheck is partitioned across the keys rather than given a catch-all `'*'` key (see
 * `partitionSpellcheck`). A repo adding a file-rewriting task of its own passes it to
 * {@link getNanoStagedConfig} as `additionalWriterTasks` rather than spreading this object and adding a key,
 * which would reintroduce the overlap for that key's files.
 */
export const obsidianDevUtilsConfig: Record<string, string[]> = partitionSpellcheck(WRITER_TASKS);

const NANO_STAGED_ENV_VARIABLE = 'NANO_STAGED';

/**
 * Resolves the nano-staged configuration to use, honoring a per-developer opt-out.
 *
 * Loads a gitignored `.env` if present, then — when `NANO_STAGED` is set to an off value (`0`, `false`,
 * `off`, or `no`) — prints a notice and exits the process successfully so the pre-commit checks are
 * skipped. This mirrors husky's own `HUSKY=0` switch, but scoped to the nano-staged step (so the
 * commit-msg hook still runs). Otherwise it returns {@link obsidianDevUtilsConfig}, or — when
 * `additionalWriterTasks` are given — the same configuration re-partitioned with those writers added.
 *
 * `NANO_STAGED` is not an npm script, so it carries its own switch rather than the script-name-derived one
 * every npm script gets — but both share the same notion of an off value, via {@link isEnvVariableOff}.
 *
 * This is a function rather than module-level code so importing the package barrel never triggers the
 * `.env` read or the process exit; call it from the thin `scripts/nano-staged-config.ts` entry. Resolving the
 * package manager is the one thing that does run at module scope, and it does neither of those two
 * things — it only probes for a lockfile.
 *
 * @param options - The optional options.
 * @returns The nano-staged task configuration. Does not return when the opt-out is active.
 */
export function getNanoStagedConfig(options?: GetNanoStagedConfigOptions): Record<string, string[]> {
  loadEnvFileIfExists();

  if (isEnvVariableOff(NANO_STAGED_ENV_VARIABLE)) {
    process.stdout.write(`nano-staged: skipped (${NANO_STAGED_ENV_VARIABLE} is off).\n`);
    process.exit(0);
  }

  const additionalWriterTasks = options?.additionalWriterTasks ?? {};
  if (Object.keys(additionalWriterTasks).length === 0) {
    return obsidianDevUtilsConfig;
  }

  const duplicatePattern = Object.keys(additionalWriterTasks).find((pattern) => Object.hasOwn(WRITER_TASKS, pattern));
  if (duplicatePattern !== undefined) {
    throw new Error(`nano-staged writer pattern '${duplicatePattern}' is already a shared writer pattern.`);
  }

  return partitionSpellcheck({ ...WRITER_TASKS, ...additionalWriterTasks });
}

/**
 * Builds a nano-staged configuration in which spellcheck never reads a file while another task rewrites it.
 *
 * The same `Promise.all` that forces two writers into one key makes a catch-all `'*'` spellcheck key run
 * CONCURRENTLY with every writer key, so cspell would read a file that ESLint or dprint is rewriting in
 * place -- a spurious finding on a half-written file, or a pass over content that is not what gets
 * committed. So the staged files are PARTITIONED instead:
 *
 * - every writer key gets spellcheck appended as its LAST command, so it reads that key's files after they
 *   have been rewritten;
 * - one complement key spellchecks exactly the files no writer key claims.
 *
 * The complement is written in nano-staged's own glob dialect, which compiles `!(...)` to a lookahead that
 * is NOT anchored at the end of the path: `!(*.md)*` would exclude `notes.md.bak` too. A nested `!(?)`
 * compiles to `(?!.)`, which IS an end anchor, so each alternative is suffixed with it. A writer pattern
 * containing `/` would switch nano-staged into globstar mode, where `*` stops crossing directories and the
 * construction no longer holds -- hence the throw. The unit test pins the partition against the installed
 * nano-staged compiler, so a release that changes its dialect fails there rather than in a commit.
 *
 * @param writerTasks - The file-rewriting tasks, keyed by the pattern that claims their files.
 * @returns The configuration, with the spellcheck step partitioned across the keys.
 */
function partitionSpellcheck(writerTasks: Readonly<Record<string, readonly string[]>>): Record<string, string[]> {
  const patterns = Object.keys(writerTasks);
  const patternWithSlash = patterns.find((pattern) => pattern.includes('/'));
  if (patternWithSlash !== undefined) {
    throw new Error(`nano-staged writer pattern '${patternWithSlash}' contains '/', which the spellcheck partition cannot express.`);
  }

  const complementPattern = `!(${patterns.map((pattern) => `${pattern}!(?)`).join('|')})*`;
  const config: Record<string, string[]> = {
    [complementPattern]: [SPELLCHECK_COMMAND]
  };

  for (const [pattern, commands] of Object.entries(writerTasks)) {
    config[pattern] = [...commands, SPELLCHECK_COMMAND];
  }

  return config;
}
