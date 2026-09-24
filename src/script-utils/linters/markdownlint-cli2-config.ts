/**
 * @file
 *
 * Default markdownlint-cli2 configuration for the Obsidian Dev Utils.
 */

/* v8 ignore start -- Declarative markdownlint-cli2 rule/plugin configuration; correctness is verified by running markdownlint, not unit tests. */

import relativeLinksRule from 'markdownlint-rule-relative-links';

import type { MarkdownlintCli2ConfigurationSchema as MarkdownlintCli2ConfigSchema } from './markdownlint-types/@types/markdownlint-cli2-config-schema.d.ts';

import { CLAUDE_WORKTREES_IGNORE_GLOB } from './lint-ignores.ts';
import { NODE_MODULES_IGNORE_GLOB } from './markdownlint-ignores.ts';
import { noSoftBreakInParagraphRule } from './markdownlint-rules/no-soft-break-in-paragraph.ts';

/**
 * Default markdownlint-cli2 configuration for the Obsidian Dev Utils.
 */
export const obsidianDevUtilsConfig: MarkdownlintCli2ConfigSchema = {
  config: {
    'MD013': false,
    'MD024': {
      // eslint-disable-next-line camelcase -- That's how it is defined in the schema.
      siblings_only: true
    },
    'MD025': {
      // `MD025` counts a front matter `title` property as the document's top-level heading, so a note carrying
      // both that property and an `# H1` is reported as having two. In an Obsidian vault that premise is false:
      // Obsidian titles a note by its FILENAME and does nothing with a `title` property, so a vault that uses
      // one as a name-bearing property would trip this rule on every note that is not wrong. Emptying
      // `front_matter_title` disables only the front matter half of the rule — two `# H1`s in one document are
      // still reported, which is the half worth keeping.
      // eslint-disable-next-line camelcase -- That's how it is defined in the schema.
      front_matter_title: ''
    },
    'MD052': {
      // eslint-disable-next-line camelcase -- That's how it is defined in the schema.
      ignored_labels: [
        // GitHub's five alert types, all of which Obsidian renders as callouts. markdownlint reads the
        // bracketed marker opening one as a shortcut reference link, so each has to be ignored explicitly.
        '!caution',
        '!important',
        '!note',
        '!tip',
        '!warning',
        // Preserve markdownlint's default ignored label so GFM task-list items (`- [x]`) are not flagged as undefined shortcut references.
        'x'
      ],
      // eslint-disable-next-line camelcase -- That's how it is defined in the schema.
      shortcut_syntax: true
    },
    // Registered but OFF by default. markdownlint enables an unlisted custom rule by default, so landing it
    // silent has to be said out loud. Every repo in this config's reach was hard-wrapped somewhere when this
    // landed, and the count is not knowable from a wrapped-line heuristic — one measured against a
    // heuristic's own top ten over-counted six files and under-counted four, worst cases 158 against 776 and
    // 74 against 34. So a repo measures itself with the rule, unwraps, and turns it on by overriding this one
    // key in its own `scripts/markdownlint-cli2-config.ts` — the same seam this repo uses for `ignores`.
    // This repo's own override does exactly that, and is the worked example.
    'no-soft-break-in-paragraph': false,
    'relative-links': true
  },
  customRules: [
    noSoftBreakInParagraphRule,
    relativeLinksRule
  ],
  // Every `.gitignore` in the tree, and up to the repository root — git's own default behavior. A path git
  // ignores is a path we do not lint, so `node_modules` (including the nested ones under test fixtures),
  // `dist`, and every generated folder are skipped without anyone maintaining a list that can drift.
  gitignore: true,
  globs: [
    '**/*.md'
  ],
  // The residual, explicit list — everything `.gitignore` cannot express for us. Git never "ignores"
  // `.git` itself (it is simply outside the working tree), and a repository can deliberately TRACK a
  // vendored `node_modules` tree, whose third-party markdown is not ours to lint. See
  // `markdownlint-ignores.ts`.
  // Claude Code's worktree folder is the third case, and a different one again: `gitignore: true` reads
  // only `.gitignore` files, while git excludes that folder through `.git/info/exclude`.
  // See `lint-ignores.ts`.
  ignores: [
    '.git/**',
    CLAUDE_WORKTREES_IGNORE_GLOB,
    NODE_MODULES_IGNORE_GLOB
  ]
};

/* v8 ignore stop */
