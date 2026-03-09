/**
 * @packageDocumentation
 *
 * Shared nano-staged configuration for pre-commit hooks.
 */

/**
 * Nano-staged configuration that runs lint and format on staged files.
 */
export const obsidianDevUtilsConfig: Record<string, string[]> = {
  '*': [
    'npm run spellcheck'
  ],
  '*.{ts,tsx,mts}': [
    'npm run build:compile:typescript',
    'npm run spellcheck',
    'npm run lint:fix',
    'npm run format'
  ],
  '*.md': [
    'npm run spellcheck',
    'npm run lint:md:fix'
  ]
};
