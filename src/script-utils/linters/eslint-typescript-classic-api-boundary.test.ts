/**
 * @file
 *
 * Unit tests for the classic-TypeScript-API `no-restricted-imports` paths exported from
 * `eslint-typescript-classic-api-boundary.ts`. The pattern is verified with a positive case (a bare
 * `typescript` import that should fire the rule) and negative cases (similar but allowed imports).
 */

import type { Linter as LinterType } from 'eslint';

import { Linter } from 'eslint';
import { parser as tseslintParser } from 'typescript-eslint';
import {
  describe,
  expect,
  it
} from 'vitest';

import { castTo } from '../../object-utils.ts';
import { typeScriptClassicApiNoRestrictedImportPaths } from './eslint-typescript-classic-api-boundary.ts';

const linter = new Linter();

const baseConfig: LinterType.Config = {
  languageOptions: {
    parser: castTo<LinterType.Parser>(tseslintParser)
  },
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [...typeScriptClassicApiNoRestrictedImportPaths]
      }
    ]
  }
};

const MESSAGE = 'Import the classic TypeScript compiler API from the `typescript-6` alias';

/**
 * Asserts that `code` does NOT produce the classic-API `no-restricted-imports` message.
 *
 * @param code - TypeScript source to lint.
 */
function expectDoesNotFire(code: string): void {
  const messages = lint(code).filter((m) => m.ruleId === 'no-restricted-imports');
  expect(messages.some((m) => m.message.includes(MESSAGE))).toBe(false);
}

/**
 * Asserts that `code` produces the classic-API `no-restricted-imports` message.
 *
 * @param code - TypeScript source to lint.
 */
function expectFires(code: string): void {
  const messages = lint(code).filter((m) => m.ruleId === 'no-restricted-imports');
  expect(messages.some((m) => m.message.includes(MESSAGE))).toBe(true);
}

/**
 * Lints a TypeScript snippet against the classic-API `no-restricted-imports` config.
 *
 * @param code - TypeScript source to lint.
 * @returns The lint messages.
 */
function lint(code: string): LinterType.LintMessage[] {
  return linter.verify(code, baseConfig);
}

describe('typeScriptClassicApiNoRestrictedImportPaths', () => {
  it('flags a value import from the bare typescript specifier', () => {
    expectFires('import { sys } from "typescript";');
  });

  it('flags a type-only import from the bare typescript specifier', () => {
    expectFires('import type { CompilerOptions } from "typescript";');
  });

  it('allows importing from the typescript-6 alias', () => {
    expectDoesNotFire('import { sys } from "typescript-6";');
  });

  it('allows importing from the typescript-7 alias', () => {
    expectDoesNotFire('import { sys } from "typescript-7";');
  });

  it('allows importing from typescript-eslint', () => {
    expectDoesNotFire('import { parser } from "typescript-eslint";');
  });

  it('allows importing from a @typescript-eslint scoped package', () => {
    expectDoesNotFire('import { TSESTree } from "@typescript-eslint/utils";');
  });
});
