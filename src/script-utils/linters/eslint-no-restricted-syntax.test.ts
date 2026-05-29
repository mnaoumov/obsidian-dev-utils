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

  describe('TSAbstractPropertyDefinition[definite=true]', () => {
    const MESSAGE = 'Do not use definite assignment assertions (!) on abstract fields.';

    it('flags `!` on an abstract class field', () => {
      expectFires('abstract class C { abstract foo!: string; }', MESSAGE);
    });

    it('allows abstract fields without `!`', () => {
      expectDoesNotFire('abstract class C { abstract foo: string; }', MESSAGE);
    });
  });

  describe(':function > Identifier TSTypeLiteral', () => {
    const MESSAGE = 'Do not use anonymous inline object types in function parameters. Define a named interface instead.';

    it('flags inline object type on a function parameter', () => {
      expectFires('function f(p: { x: number }) {}', MESSAGE);
    });

    it('allows named type on a function parameter', () => {
      expectDoesNotFire('interface P { x: number; } function f(p: P) {}', MESSAGE);
    });
  });

  describe(':function > TSTypeAnnotation TSTypeLiteral', () => {
    const MESSAGE = 'Do not use anonymous inline object types in function return types. Define a named interface instead.';

    it('flags inline object type as a function return', () => {
      expectFires('function f(): { x: number } { return { x: 1 }; }', MESSAGE);
    });

    it('allows named return type', () => {
      expectDoesNotFire('interface R { x: number; } function f(): R { return { x: 1 }; }', MESSAGE);
    });
  });

  describe('TSMethodSignature TSTypeLiteral', () => {
    const MESSAGE = 'Do not use anonymous inline object types in interface/method signatures. Define a named interface instead.';

    it('flags inline object in an interface method signature', () => {
      expectFires('interface I { m(p: { x: number }): void; }', MESSAGE);
    });

    it('allows named param type in an interface method signature', () => {
      expectDoesNotFire('interface P { x: number; } interface I { m(p: P): void; }', MESSAGE);
    });
  });

  describe('TSTypeParameterInstantiation TSTypeLiteral', () => {
    const MESSAGE = 'Do not use anonymous inline object types as type arguments. Define a named interface instead.';

    it('flags inline object as a generic type argument', () => {
      expectFires('const xs: Array<{ a: number }> = [];', MESSAGE);
    });

    it('allows named type as a generic type argument', () => {
      expectDoesNotFire('interface A { a: number; } const xs: Array<A> = [];', MESSAGE);
    });
  });

  describe('TSTypeAnnotation TSTypeLiteral', () => {
    const MESSAGE = 'Do not use anonymous inline object types in type annotations. Define a named interface instead.';

    it('flags inline object type on a variable annotation', () => {
      expectFires('const x: { a: number } = { a: 1 };', MESSAGE);
    });

    it('allows named type on a variable annotation', () => {
      expectDoesNotFire('interface A { a: number; } const x: A = { a: 1 };', MESSAGE);
    });
  });

  describe('TSAsExpression TSTypeLiteral', () => {
    const MESSAGE = 'Do not use anonymous inline object types in type assertions. Define a named interface instead.';

    it('flags inline object type in an `as` cast', () => {
      expectFires('const x = ({} as { a: number });', MESSAGE);
    });

    it('allows named type in an `as` cast', () => {
      expectDoesNotFire('interface A { a: number; } const x = ({} as A);', MESSAGE);
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

  describe('ImportExpression', () => {
    const MESSAGE = 'Avoid dynamic import(). Use static imports instead. Only use dynamic imports for lazy/conditional loading.';

    it('flags dynamic `import()` calls', () => {
      expectFires('async function f() { await import("./foo.ts"); }', MESSAGE);
    });

    it('allows static `import` statements', () => {
      expectDoesNotFire('import { foo } from "./foo.ts";', MESSAGE);
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
