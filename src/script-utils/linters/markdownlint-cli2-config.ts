/**
 * @file
 *
 * Default markdownlint-cli2 configuration for the Obsidian Dev Utils.
 */

/* v8 ignore start -- Declarative markdownlint-cli2 rule/plugin configuration; correctness is verified by running markdownlint, not unit tests. */

import relativeLinksRule from 'markdownlint-rule-relative-links';

import type { MarkdownlintCli2ConfigurationSchema } from './markdownlint-types/@types/markdownlint-cli2-config-schema.d.ts';

/**
 * Default markdownlint-cli2 configuration for the Obsidian Dev Utils.
 */
export const obsidianDevUtilsConfig: MarkdownlintCli2ConfigurationSchema = {
  config: {
    'MD013': false,
    'MD024': {
      // eslint-disable-next-line camelcase -- That's how it is defined in the schema.
      siblings_only: true
    },
    'MD052': {
      // eslint-disable-next-line camelcase -- That's how it is defined in the schema.
      ignored_labels: [
        '!note',
        '!warning',
        // Preserve markdownlint's default ignored label so GFM task-list items (`- [x]`) are not flagged as undefined shortcut references.
        'x'
      ],
      // eslint-disable-next-line camelcase -- That's how it is defined in the schema.
      shortcut_syntax: true
    },
    'relative-links': true
  },
  customRules: [
    relativeLinksRule
  ],
  // Every `.gitignore` in the tree, and up to the repository root — git's own default behavior. A path git
  // Ignores is a path we do not lint, so `node_modules` (including the nested ones under test fixtures),
  // `dist`, and every generated folder are skipped without anyone maintaining a list that can drift.
  gitignore: true,
  globs: [
    '**/*.md'
  ],
  // Git never "ignores" `.git` itself — it is simply outside the working tree — so this one stays explicit.
  ignores: [
    '.git/**'
  ]
};

/* v8 ignore stop */
