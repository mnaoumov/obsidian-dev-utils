import type { Rule } from 'eslint';

import { RuleTester } from '@typescript-eslint/rule-tester';
import {
  afterAll,
  describe,
  it,
  vi
} from 'vitest';

import { noAsyncCallbackToAnyReturn } from './no-async-callback-to-any-return.ts';

const TYPE_CHECK_TIMEOUT_IN_MILLISECONDS = 30_000;

vi.setConfig({ testTimeout: TYPE_CHECK_TIMEOUT_IN_MILLISECONDS });

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ['*.ts']
      }
    }
  }
});

/**
 * Casts an ESLint v10 `Rule.RuleModule` to the type expected by
 * `@typescript-eslint/rule-tester`. The types are incompatible at the type
 * level because typescript-eslint hasn't updated for ESLint v10 yet, but
 * they are compatible at runtime.
 *
 * @param rule - The ESLint rule module.
 * @returns The same rule, typed for the rule tester.
 */
function toRuleTesterModule(rule: Rule.RuleModule): Parameters<typeof ruleTester.run>[1] {
  // Bridge ESLint v10 Rule.RuleModule to @typescript-eslint/rule-tester's RuleModule.
  // Structurally compatible but nominally incompatible until typescript-eslint updates.
  const bridged: unknown = rule;

  return bridged as Parameters<typeof ruleTester.run>[1];
}

const MESSAGE_ID = 'noAsyncCallbackToAnyReturn';

ruleTester.run('no-async-callback-to-any-return', toRuleTesterModule(noAsyncCallbackToAnyReturn), {
  invalid: [
    {
      code: `
        declare function onClick(fn: (evt: MouseEvent) => any): void;
        onClick(async () => {});
      `,
      errors: [{ messageId: MESSAGE_ID }],
      name: 'async arrow passed to callback with => any return'
    },
    {
      code: `
        declare function onClick(fn: (evt: MouseEvent) => any): void;
        onClick(async function() {});
      `,
      errors: [{ messageId: MESSAGE_ID }],
      name: 'async function expression passed to callback with => any return'
    },
    {
      code: `
        declare function onClick(fn: (evt: MouseEvent) => unknown): void;
        onClick(async () => {});
      `,
      errors: [{ messageId: MESSAGE_ID }],
      name: 'async arrow passed to callback with => unknown return'
    },
    {
      code: `
        declare function register(name: string, fn: () => any): void;
        register('test', async () => {});
      `,
      errors: [{ messageId: MESSAGE_ID }],
      name: 'async callback as second argument with => any return'
    },
    {
      code: `
        declare class Button { onClick(fn: (evt: MouseEvent) => any): void; }
        declare const btn: Button;
        btn.onClick(async () => {});
      `,
      errors: [{ messageId: MESSAGE_ID }],
      name: 'async arrow passed to method with => any return'
    }
  ],
  valid: [
    {
      code: `
        declare function onClick(fn: (evt: MouseEvent) => any): void;
        onClick(() => {});
      `,
      name: 'non-async callback to => any return (fine)'
    },
    {
      code: `
        declare function onClick(fn: (evt: MouseEvent) => void): void;
        onClick(async () => {});
      `,
      name: 'async callback to => void return (handled by no-misused-promises)'
    },
    {
      code: `
        declare function onClick(fn: (evt: MouseEvent) => Promise<void>): void;
        onClick(async () => {});
      `,
      name: 'async callback to => Promise<void> return (correct usage)'
    },
    {
      code: `
        declare function onClick(fn: (evt: MouseEvent) => string): void;
        onClick(() => 'ok');
      `,
      name: 'non-async callback to => string return'
    },
    {
      code: `
        declare function register(name: string, fn: () => Promise<void>): void;
        register('test', async () => {});
      `,
      name: 'async callback as second argument with => Promise<void> return'
    },
    {
      code: `
        declare function takesOne(fn: () => void): void;
        takesOne(() => {}, async () => {});
      `,
      name: 'extra async arg beyond declared params (no param to check)'
    }
  ]
});
