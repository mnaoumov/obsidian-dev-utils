/**
 * @packageDocumentation
 *
 * Default markdownlint-cli2 configuration for the Obsidian Dev Utils.
 */

import relativeLinksRule from 'markdownlint-rule-relative-links';

import type { MarkdownlintCli2ConfigurationSchema } from './@types/markdownlint-cli2-config-schema.d.ts';

/**
 * Default markdownlint-cli2 configuration for the Obsidian Dev Utils.
 */
export const obsidianDevUtilsConfig: MarkdownlintCli2ConfigurationSchema = {
  config: {
    'MD013': false,
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
