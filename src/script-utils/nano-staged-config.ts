/**
 * @packageDocumentation
 *
 * Shared nano-staged configuration for pre-commit hooks.
 */

/**
 * Nano-staged configuration that runs file-based lint, format, and spellcheck on staged files.
 *
 * Only includes tools that can operate on individual files. Whole-project checks
 * (TypeScript compilation, unit tests) are left to CI.
 *
 * Commands use `npm run ... --` so nano-staged file paths are forwarded as CLI arguments.
 */
export const obsidianDevUtilsConfig: Record<string, string[]> = {
  '*': [
    'npm run spellcheck --'
  ],
  '*.{ts,tsx,mts}': [
    'npm run lint:fix --',
    'npm run format --'
  ],
  '*.md': [
    'npm run lint:md:fix --'
  ]
};
