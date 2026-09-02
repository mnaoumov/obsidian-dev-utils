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
 * The `<manager> run` prefix every task below is built on, resolved once for the process.
 *
 * Detection probes for a lockfile beside `package.json`, so it is a handful of `existsSync` calls and
 * nothing more — no `.env` read and no `process.exit`, which is what lets it sit at module scope.
 */
const PACKAGE_MANAGER_RUN_COMMAND = getPackageManagerRunCommand().join(' ');

/**
 * Nano-staged configuration that runs file-based lint, format, and spellcheck on staged files.
 *
 * Only includes tools that can operate on individual files. Whole-project checks
 * (TypeScript compilation, unit tests) are left to CI.
 *
 * Commands run through the package manager that owns the tree — `npm run ... --`, `bun run ... --`, and
 * so on — so nano-staged file paths are forwarded as CLI arguments.
 */
export const obsidianDevUtilsConfig: Record<string, string[]> = {
  /*
   * Lint everything except the `templates/` consumer templates: ESLint globally ignores them, and
   * they ship their own consumer-facing config/scripts that cannot resolve in-repo, so passing one
   * by explicit path errors out. The `!(templates)` negation drops any path that begins with
   * `templates`. Formatting and spellchecking still cover `templates/` via the entries above and below.
   */
  '!(templates)*.{ts,tsx,mts}': [
    `${PACKAGE_MANAGER_RUN_COMMAND} lint:fix --`
  ],
  '*': [
    `${PACKAGE_MANAGER_RUN_COMMAND} spellcheck --`
  ],
  '*.{ts,tsx,mts}': [
    `${PACKAGE_MANAGER_RUN_COMMAND} format --`
  ],
  '*.md': [
    `${PACKAGE_MANAGER_RUN_COMMAND} lint:md:fix --`
  ]
};

const NANO_STAGED_ENV_VARIABLE = 'NANO_STAGED';

/**
 * Resolves the nano-staged configuration to use, honoring a per-developer opt-out.
 *
 * Loads a gitignored `.env` if present, then — when `NANO_STAGED` is set to an off value (`0`, `false`,
 * `off`, or `no`) — prints a notice and exits the process successfully so the pre-commit checks are
 * skipped. This mirrors husky's own `HUSKY=0` switch, but scoped to the nano-staged step (so the
 * commit-msg hook still runs). Otherwise it returns {@link obsidianDevUtilsConfig}.
 *
 * `NANO_STAGED` is not an npm script, so it carries its own switch rather than the script-name-derived one
 * every npm script gets — but both share the same notion of an off value, via {@link isEnvVariableOff}.
 *
 * This is a function rather than module-level code so importing the package barrel never triggers the
 * `.env` read or the process exit; call it from the thin `scripts/nano-staged-config.ts` entry. Resolving the
 * package manager is the one thing that does run at module scope, and it does neither of those two
 * things — it only probes for a lockfile.
 *
 * @returns The nano-staged task configuration. Does not return when the opt-out is active.
 */
export function getNanoStagedConfig(): Record<string, string[]> {
  loadEnvFileIfExists();

  if (isEnvVariableOff(NANO_STAGED_ENV_VARIABLE)) {
    process.stdout.write(`nano-staged: skipped (${NANO_STAGED_ENV_VARIABLE} is off).\n`);
    process.exit(0);
  }

  return obsidianDevUtilsConfig;
}
