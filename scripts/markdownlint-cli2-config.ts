import type { MarkdownlintCli2ConfigurationSchema as MarkdownlintCli2ConfigSchema } from '../src/script-utils/linters/markdownlint-types/@types/markdownlint-cli2-config-schema.d.ts';

import { obsidianDevUtilsConfig } from '../src/script-utils/linters/markdownlint-cli2-config.ts';

export const config: MarkdownlintCli2ConfigSchema = {
  ...obsidianDevUtilsConfig,
  config: {
    ...obsidianDevUtilsConfig.config,
    // Turned ON here, against the shared default of OFF. This repo has been measured with the rule and
    // unwrapped — 1134 findings over `AGENTS.md`, `README.md` and `CHANGELOG.md`, now zero — so the rule
    // costs nothing to keep on and is the only thing that stops the wrapping coming back. Each other repo
    // turns it on the same way, once it has done the same measure-and-unwrap.
    'no-soft-break-in-paragraph': true
  },
  // The `docs/` Astro + Starlight sub-project follows Starlight's frontmatter-driven conventions
  // (title in frontmatter, no body H1) and holds generated API markdown; it is validated by its own
  // `astro build`, not this repo's markdownlint.
  ignores: [
    ...obsidianDevUtilsConfig.ignores ?? [],
    'docs/**'
  ]
};
