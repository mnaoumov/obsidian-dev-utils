import {
  describe,
  expect,
  it
} from 'vitest';

import { defineEslintConfigs } from './linters/eslint-config.ts';
import { CLAUDE_WORKTREES_IGNORE_GLOB } from './linters/lint-ignores.ts';
import { obsidianDevUtilsConfig } from './linters/markdownlint-cli2-config.ts';

describe('CLAUDE_WORKTREES_IGNORE_GLOB', () => {
  it('should match everything under Claude Code\'s worktree folder', () => {
    expect(CLAUDE_WORKTREES_IGNORE_GLOB).toBe('.claude/worktrees/**');
  });
});

/*
 * The linters derive their ignore set from `.gitignore`, which cannot answer this path: git excludes the
 * worktree folder through `.git/info/exclude` instead. Each linter therefore needs an explicit entry, and
 * losing one is invisible until a session happens to have a worktree open -- ESLint then runs out of
 * memory rather than naming the directory. These two assertions are that regression guard; whether the
 * entry actually prunes the walk is a question for running the linters, not for a unit test.
 */
describe('the shared ignore reaches every linter that walks the tree', () => {
  it('should be a global ignore in the ESLint configuration', () => {
    const configs = defineEslintConfigs();
    const isGlobalIgnore = configs.some((config) => config.files === undefined && (config.ignores?.includes(CLAUDE_WORKTREES_IGNORE_GLOB) ?? false));
    expect(isGlobalIgnore).toBe(true);
  });

  it('should be an ignore in the markdownlint-cli2 configuration', () => {
    expect(obsidianDevUtilsConfig.ignores).toContain(CLAUDE_WORKTREES_IGNORE_GLOB);
  });
});
