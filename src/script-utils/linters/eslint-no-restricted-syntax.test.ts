/**
 * @file
 *
 * Unit tests for each `no-restricted-syntax` selector exported from
 * `eslint-no-restricted-syntax.ts`. Each selector is verified with at least
 * one positive case (snippet that should fire the rule) and one negative
 * case (similar but valid snippet).
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
import { noRestrictedSyntaxRuleEntries } from './eslint-no-restricted-syntax.ts';

const linter = new Linter();

const baseConfig: LinterType.Config = {
  languageOptions: {
    parser: castTo<LinterType.Parser>(tseslintParser)
  },
  rules: {
    'no-restricted-syntax': [
      'error',
      ...noRestrictedSyntaxRuleEntries
    ]
  }
};

/**
 * Asserts that `code` does NOT produce a message containing `expected` from
 * the `no-restricted-syntax` rule.
 *
 * @param code - TypeScript source to lint.
 * @param expected - Substring that must not appear in any message.
 */
function expectDoesNotFire(code: string, expected: string): void {
  const messages = lint(code).filter((m) => m.ruleId === 'no-restricted-syntax');
  expect(messages.some((m) => m.message.includes(expected))).toBe(false);
}

/**
 * Asserts that `code` produces a message containing `expected` from the
 * `no-restricted-syntax` rule.
 *
 * @param code - TypeScript source to lint.
 * @param expected - Substring expected in at least one message.
 */
function expectFires(code: string, expected: string): void {
  const messages = lint(code).filter((m) => m.ruleId === 'no-restricted-syntax');
  expect(messages.some((m) => m.message.includes(expected))).toBe(true);
}

/**
 * Lints a TypeScript snippet against the shared `no-restricted-syntax` config
 * and returns the messages produced.
 *
 * @param code - TypeScript source to lint.
 * @returns The lint messages.
 */
function lint(code: string): LinterType.LintMessage[] {
  return linter.verify(code, baseConfig);
}

describe('noRestrictedSyntaxRuleEntries', () => {
  describe('PropertyDefinition[definite=true]', () => {
    const MESSAGE = 'Do not use definite assignment assertions (!). Initialize the field or make it optional.';

    it('flags `!` on a concrete class field', () => {
      expectFires('class C { foo!: string; }', MESSAGE);
    });

    it('allows optional class fields', () => {
      expectDoesNotFire('class C { foo?: string; }', MESSAGE);
    });

    it('allows initialized class fields', () => {
      expectDoesNotFire('class C { foo: string = ""; }', MESSAGE);
    });
  });

  describe('TSTypeLiteral:not(TSTypeAliasDeclaration > TSTypeLiteral)', () => {
    const MESSAGE = 'Do not use anonymous inline object types. Define a named interface or `type` alias instead.';

    it('flags inline object type on a function parameter', () => {
      expectFires('function f(p: { x: number }) {}', MESSAGE);
    });

    it('flags inline object type as a function return', () => {
      expectFires('function f(): { x: number } { return { x: 1 }; }', MESSAGE);
    });

    it('flags inline object in an interface method signature', () => {
      expectFires('interface I { m(p: { x: number }): void; }', MESSAGE);
    });

    it('flags inline object as a generic type argument', () => {
      expectFires('const xs: Array<{ a: number }> = [];', MESSAGE);
    });

    it('flags inline object type on a variable annotation', () => {
      expectFires('const x: { a: number } = { a: 1 };', MESSAGE);
    });

    it('flags inline object type in an `as` cast', () => {
      expectFires('const x = ({} as { a: number });', MESSAGE);
    });

    it('flags inline object type as a union member of a type alias', () => {
      expectFires('type T = { a: number } | { b: number };', MESSAGE);
    });

    it('flags inline object type nested inside a generic in a type alias', () => {
      expectFires('type T = Partial<{ a: number }>;', MESSAGE);
    });

    it('flags inline object type as a generic constraint', () => {
      expectFires('function f<T extends { a: number }>(p: T) { return p; }', MESSAGE);
    });

    it('allows an anonymous object type as the sole body of a type alias', () => {
      expectDoesNotFire('type T = { a: number };', MESSAGE);
    });

    it('allows an exported anonymous object type as the sole body of a type alias', () => {
      expectDoesNotFire('export type T = { a: number };', MESSAGE);
    });

    it('allows a named interface', () => {
      expectDoesNotFire('interface I { a: number; }', MESSAGE);
    });

    it('allows named types in non-alias positions', () => {
      expectDoesNotFire('interface A { a: number; } const x: A = { a: 1 };', MESSAGE);
    });
  });

  describe('TSMappedType:not(TSTypeAliasDeclaration > TSMappedType)', () => {
    const MESSAGE = 'Do not use anonymous inline mapped types. Define a named `type` alias instead.';

    it('flags an anonymous mapped type nested inside a generic in a type alias', () => {
      expectFires('type T<O> = Partial<{ [K in keyof O]: O[K] }>;', MESSAGE);
    });

    it('flags an anonymous mapped type on a variable annotation', () => {
      expectFires('declare const x: { [K in "a" | "b"]: number };', MESSAGE);
    });

    it('allows a mapped type as the sole body of a type alias', () => {
      expectDoesNotFire('type T<O> = { [K in keyof O]: O[K] };', MESSAGE);
    });

    it('allows an index signature object type as the sole body of a type alias', () => {
      expectDoesNotFire('type T = { [key: string]: number };', MESSAGE);
    });
  });

  describe('TSAsExpression > TSAsExpression', () => {
    const MESSAGE = 'Do not use double type assertions (as X as Y).';

    it('flags `as X as Y` double assertions', () => {
      expectFires('const x = (1 as unknown) as string;', MESSAGE);
    });

    it('allows a single `as` cast', () => {
      expectDoesNotFire('const x = 1 as number;', MESSAGE);
    });
  });

  describe('TSAsExpression > TSNeverKeyword', () => {
    const MESSAGE = 'Do not use `as never`';

    it('flags `as never`', () => {
      expectFires('const x = 1 as never;', MESSAGE);
    });

    it('allows `as` to a non-never type', () => {
      expectDoesNotFire('const x = 1 as number;', MESSAGE);
    });
  });

  describe('TSTypeAssertion > TSNeverKeyword', () => {
    const MESSAGE = 'Do not use `<never>` type assertions.';

    it('flags `<never>x` type assertions', () => {
      expectFires('const x = <never>1;', MESSAGE);
    });

    it('allows `<T>x` to a non-never type', () => {
      expectDoesNotFire('const x = <number>1;', MESSAGE);
    });
  });

  describe('MethodDefinition[key.name=/^_/]:not([override=true])', () => {
    const MESSAGE = 'Do not use _ prefix on methods or functions. The _ prefix is for unused parameters only.';

    it('flags a method with `_` prefix', () => {
      expectFires('class C { _foo() {} }', MESSAGE);
    });

    it('allows a method without `_` prefix', () => {
      expectDoesNotFire('class C { foo() {} }', MESSAGE);
    });

    it('allows an overridden `_` method', () => {
      expectDoesNotFire('abstract class B { abstract _foo(): void; } class C extends B { override _foo() {} }', MESSAGE);
    });
  });

  describe('FunctionDeclaration[id.name=/^_/]', () => {
    const MESSAGE = 'Do not use _ prefix on methods or functions. The _ prefix is for unused parameters only.';

    it('flags a function with `_` prefix', () => {
      expectFires('function _foo() {}', MESSAGE);
    });

    it('allows a function without `_` prefix', () => {
      expectDoesNotFire('function foo() {}', MESSAGE);
    });
  });

  describe('ImportSpecifier[local.name=/Mock/]:not([imported.name=/Mock/])', () => {
    const MESSAGE = 'Do not rename imports with "Mock" in the alias. Mock classes are the canonical types — use the original name.';

    it('flags renaming a non-Mock import to a Mock alias', () => {
      expectFires('import { App as MockApp } from "x";', MESSAGE);
    });

    it('allows importing an already-Mock-named export under its own name', () => {
      expectDoesNotFire('import { MockApp } from "x";', MESSAGE);
    });

    it('allows renaming with a non-Mock alias', () => {
      expectDoesNotFire('import { App as AppOriginal } from "x";', MESSAGE);
    });
  });

  describe('PropertyDefinition[declare=true]', () => {
    const MESSAGE = 'Do not use `declare` on class properties. Initialize the property or use a regular type annotation.';

    it('flags `declare` on a class property', () => {
      expectFires('class C { declare foo: string; }', MESSAGE);
    });

    it('allows initialized class properties', () => {
      expectDoesNotFire('class C { foo: string = ""; }', MESSAGE);
    });
  });
});
