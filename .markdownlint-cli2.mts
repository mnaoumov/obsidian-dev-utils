/**
 * @packageDocumentation
 *
 * Markdownlint configuration.
 */

import type { MarkdownlintCli2ConfigurationSchema } from './src/ScriptUtils/linters/markdownlint/@types/markdownlint-cli2-config-schema.d.ts';

import { obsidianDevUtilsConfig } from './src/ScriptUtils/linters/markdownlint/markdownlint-cli2-config.ts';

/**
 * Markdownlint configuration.
 */
export const config: MarkdownlintCli2ConfigurationSchema = {
  ...obsidianDevUtilsConfig
};
