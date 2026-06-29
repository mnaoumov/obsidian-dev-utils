/**
 * @file
 *
 * Unit tests for the agnostic-core-boundary `no-restricted-imports` patterns exported from
 * `eslint-agnostic-core-boundary.ts`. Each pattern is verified with a positive case (an import that
 * should fire the rule) and negative cases (similar but allowed imports).
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
import { agnosticCoreBoundaryNoRestrictedImportPatterns } from './eslint-agnostic-core-boundary.ts';

const linter = new Linter();

const baseConfig: LinterType.Config = {
  languageOptions: {
    parser: castTo<LinterType.Parser>(tseslintParser)
  },
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [...agnosticCoreBoundaryNoRestrictedImportPatterns]
      }
    ]
  }
};

const MESSAGE = 'Obsidian-runtime-agnostic top-level `src/*.ts` modules must not import the Obsidian layer';

/**
 * Asserts that `code` does NOT produce a `no-restricted-imports` message.
 *
 * @param code - TypeScript source to lint.
 */
function expectDoesNotFire(code: string): void {
  const messages = lint(code).filter((m) => m.ruleId === 'no-restricted-imports');
  expect(messages.some((m) => m.message.includes(MESSAGE))).toBe(false);
}

/**
 * Asserts that `code` produces a `no-restricted-imports` message from the boundary patterns.
 *
 * @param code - TypeScript source to lint.
 */
function expectFires(code: string): void {
  const messages = lint(code).filter((m) => m.ruleId === 'no-restricted-imports');
  expect(messages.some((m) => m.message.includes(MESSAGE))).toBe(true);
}

/**
 * Lints a TypeScript snippet against the boundary `no-restricted-imports` config.
 *
 * @param code - TypeScript source to lint.
 * @returns The lint messages.
 */
function lint(code: string): LinterType.LintMessage[] {
  return linter.verify(code, baseConfig);
}

describe('agnosticCoreBoundaryNoRestrictedImportPatterns', () => {
  it('flags importing a direct obsidian-layer module', () => {
    expectFires('import { x } from "./obsidian/is-in-obsidian.ts";');
  });

  it('flags importing a nested obsidian-layer module', () => {
    expectFires('import { x } from "./obsidian/plugin/plugin-context.ts";');
  });

  it('flags importing the obsidian-layer barrel', () => {
    expectFires('import { x } from "./obsidian/index.ts";');
  });

  it('flags a type-only import of an obsidian-layer module', () => {
    expectFires('import type { X } from "./obsidian/is-in-obsidian.ts";');
  });

  it('allows importing a sibling agnostic module', () => {
    expectDoesNotFire('import { x } from "./library.ts";');
  });

  it('allows importing a non-obsidian subfolder module', () => {
    expectDoesNotFire('import { x } from "./codemirror/foo.ts";');
  });

  it('allows importing an external package', () => {
    expectDoesNotFire('import { x } from "obsidian";');
  });
});
