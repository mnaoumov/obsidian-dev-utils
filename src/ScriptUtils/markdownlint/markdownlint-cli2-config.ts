/**
 * @packageDocumentation
 *
 * Default markdownlint-cli2 configuration for the Obsidian Dev Utils.
 */

/* v8 ignore start -- Declarative markdownlint-cli2 rule/plugin configuration; correctness is verified by running markdownlint, not unit tests. */

import relativeLinksRule from 'markdownlint-rule-relative-links';

import type { MarkdownlintCli2ConfigurationSchema } from './@types/markdownlint-cli2-config-schema.d.ts';

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
        '!warning'
      ],
      // eslint-disable-next-line camelcase -- That's how it is defined in the schema.
      shortcut_syntax: true
    },
    'relative-links': true
  },
  customRules: [
    relativeLinksRule
  ],
  globs: [
    '**/*.md'
  ],
  ignores: [
    'node_modules/**',
    '.git/**',
    'dist/**'
  ]
};

/* v8 ignore stop */
