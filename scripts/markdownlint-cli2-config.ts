import type { MarkdownlintCli2ConfigurationSchema } from '../src/script-utils/linters/markdownlint-types/@types/markdownlint-cli2-config-schema.d.ts';

import { obsidianDevUtilsConfig } from '../src/script-utils/linters/markdownlint-cli2-config.ts';

export const config: MarkdownlintCli2ConfigurationSchema = {
  ...obsidianDevUtilsConfig,
  // The `docs/` Astro + Starlight sub-project follows Starlight's frontmatter-driven conventions
  // (title in frontmatter, no body H1) and holds generated API markdown; it is validated by its own
  // `astro build`, not this repo's markdownlint.
  ignores: [
    ...obsidianDevUtilsConfig.ignores ?? [],
    'docs/**'
  ]
};
