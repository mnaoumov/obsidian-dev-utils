/**
 * @packageDocumentation
 *
 * Markdownlint configuration.
 */

import type { MarkdownlintCli2ConfigurationSchema } from './src/script-utils/linters/markdownlint-types/@types/markdownlint-cli2-config-schema.d.ts';

import { obsidianDevUtilsConfig } from './src/script-utils/linters/markdownlint-cli2-config.ts';

/**
 * Markdownlint configuration.
 */
export const config: MarkdownlintCli2ConfigurationSchema = {
  ...obsidianDevUtilsConfig
};
