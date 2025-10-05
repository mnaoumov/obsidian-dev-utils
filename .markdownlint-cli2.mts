import type { MarkdownlintCli2ConfigurationSchema } from './src/ScriptUtils/markdownlint/@types/markdownlint-cli2-config-schema.d.ts';
import { obsidianDevUtilsConfig } from './src/ScriptUtils/markdownlint/markdownlint-cli2-config.ts';

export const config: MarkdownlintCli2ConfigurationSchema = {
  ...obsidianDevUtilsConfig
};
