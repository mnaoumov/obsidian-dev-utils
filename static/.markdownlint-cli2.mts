import type { MarkdownlintCli2ConfigurationSchema } from 'obsidian-dev-utils/script-utils/markdownlint/@types/markdownlint-cli2-config-schema';

import { obsidianDevUtilsConfig } from 'obsidian-dev-utils/script-utils/markdownlint/markdownlint-cli2-config';

export const config: MarkdownlintCli2ConfigurationSchema = {
  ...obsidianDevUtilsConfig
};
