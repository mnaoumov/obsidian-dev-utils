/**
 * @file
 *
 * Unit tests for the package-boundary `no-restricted-imports` patterns exported from
 * `eslint-agnostic-core-boundary.ts`. Each pattern is verified with positive cases (imports that should fire the
 * rule) and negative cases (similar but allowed imports).
 */

import type { Linter as LinterType } from 'eslint';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { Linter } from 'eslint';
import { parser as tseslintParser } from 'typescript-eslint';
import {
  describe,
  expect,
  it
} from 'vitest';

import { getPackageBoundaryNoRestrictedImportPatterns } from './eslint-agnostic-core-boundary.ts';

const linter = new Linter();

const MESSAGE = '`@scope/lib` must not import `@scope/obsidian-lib`';

/**
 * Asserts that `code` does NOT produce a `no-restricted-imports` message.
 *
 * @param code - TypeScript source to lint.
 */
function expectDoesNotFire(code: string): void {
  expect(lint(code).some((message) => message.ruleId === 'no-restricted-imports')).toBe(false);
}

/**
 * Asserts that `code` produces a `no-restricted-imports` message from the boundary patterns.
 *
 * @param code - TypeScript source to lint.
 */
function expectFires(code: string): void {
  const messages = lint(code).filter((message) => message.ruleId === 'no-restricted-imports');
  expect(messages.some((message) => message.message.includes(MESSAGE))).toBe(true);
}

/**
 * Lints a TypeScript snippet against the boundary `no-restricted-imports` config.
 *
 * @param code - TypeScript source to lint.
 * @returns The lint messages.
 */
function lint(code: string): LinterType.LintMessage[] {
  const config: LinterType.Config = {
    languageOptions: {
      parser: castTo<LinterType.Parser>(tseslintParser)
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: getPackageBoundaryNoRestrictedImportPatterns({
            forbiddenPackageNames: ['@scope/obsidian-lib'],
            packageName: '@scope/lib'
          })
        }
      ]
    }
  };
  return linter.verify(code, config);
}

describe('getPackageBoundaryNoRestrictedImportPatterns', () => {
  it('should flag importing the forbidden package root', () => {
    expectFires('import { x } from "@scope/obsidian-lib";');
  });

  it('should flag importing a forbidden package subpath', () => {
    expectFires('import { x } from "@scope/obsidian-lib/plugin/plugin";');
  });

  it('should flag a type-only import too', () => {
    expectFires('import type { X } from "@scope/obsidian-lib/plugin/plugin";');
  });

  it('should allow importing a package that is not forbidden', () => {
    expectDoesNotFire('import { x } from "@scope/lib/async";');
  });

  it('should allow a package whose name merely starts with the forbidden one', () => {
    expectDoesNotFire('import { x } from "@scope/obsidian-lib-extras";');
  });

  it('should allow relative imports', () => {
    expectDoesNotFire('import { x } from "./obsidian-lib.ts";');
  });

  it('should build no patterns when nothing is forbidden', () => {
    expect(getPackageBoundaryNoRestrictedImportPatterns({ forbiddenPackageNames: [], packageName: '@scope/lib' })).toEqual([]);
  });
});
