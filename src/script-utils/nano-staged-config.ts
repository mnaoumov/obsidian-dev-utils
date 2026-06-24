/**
 * @file
 *
 * Shared nano-staged configuration for pre-commit hooks.
 */

import { existsSync } from 'node:fs';
import process from 'node:process';

/**
 * Nano-staged configuration that runs file-based lint, format, and spellcheck on staged files.
 *
 * Only includes tools that can operate on individual files. Whole-project checks
 * (TypeScript compilation, unit tests) are left to CI.
 *
 * Commands use `npm run ... --` so nano-staged file paths are forwarded as CLI arguments.
 */
export const obsidianDevUtilsConfig: Record<string, string[]> = {
  /*
   * Lint everything except the `templates/` consumer templates: ESLint globally ignores them, and
   * they ship their own consumer-facing config/scripts that cannot resolve in-repo, so passing one
   * by explicit path errors out. The `!(templates)` negation drops any path that begins with
   * `templates`. Formatting and spellchecking still cover `templates/` via the entries above and below.
   */
  '!(templates)*.{ts,tsx,mts}': [
    'npm run lint:fix --'
  ],
  '*': [
    'npm run spellcheck --'
  ],
  '*.{ts,tsx,mts}': [
    'npm run format --'
  ],
  '*.md': [
    'npm run lint:md:fix --'
  ]
};

const NANO_STAGED_OFF_VALUES: ReadonlySet<string> = new Set(['0', 'false', 'no', 'off']);

/**
 * Resolves the nano-staged configuration to use, honoring a per-developer opt-out.
 *
 * Loads a gitignored `.env` if present (via Node's own `process.loadEnvFile`, so it behaves the same
 * on every platform and shell), then — when `NANO_STAGED` is set to an off value (`0`, `false`, `off`,
 * or `no`) — prints a notice and exits the process successfully so the pre-commit checks are skipped.
 * This mirrors husky's own `HUSKY=0` switch, but scoped to the nano-staged step (so the commit-msg
 * hook still runs). Otherwise it returns {@link obsidianDevUtilsConfig}.
 *
 * This is a function rather than module-level code so importing the package barrel never triggers the
 * `.env` read or the process exit; call it from the thin `scripts/nano-staged-config.ts` entry.
 *
 * @returns The nano-staged task configuration. Does not return when the opt-out is active.
 */
export function getNanoStagedConfig(): Record<string, string[]> {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  if (isNanoStagedDisabled(process.env['NANO_STAGED'])) {
    process.stdout.write('nano-staged: skipped (NANO_STAGED is off).\n');
    process.exit(0);
  }

  return obsidianDevUtilsConfig;
}

function isNanoStagedDisabled(value: string | undefined): boolean {
  return NANO_STAGED_OFF_VALUES.has((value ?? '').trim().toLowerCase());
}
