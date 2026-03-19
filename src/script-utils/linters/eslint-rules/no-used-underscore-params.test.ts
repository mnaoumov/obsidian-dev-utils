import type { Rule } from 'eslint';

import { RuleTester } from '@typescript-eslint/rule-tester';
import {
  afterAll,
  describe,
  it
} from 'vitest';

import { noUsedUnderscoreParams } from './no-used-underscore-params.ts';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester();

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

const MESSAGE_ID = 'noUsedUnderscoreParams';

ruleTester.run('no-used-underscore-params', toRuleTesterModule(noUsedUnderscoreParams), {
  invalid: [
    {
      code: 'function foo(_x: number) { return _x + 1; }',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'underscore param used in function body'
    },
    {
      code: 'const fn = (_a: string, _b: number) => _a + _b;',
      errors: [
        { messageId: MESSAGE_ID },
        { messageId: MESSAGE_ID }
      ],
      name: 'multiple underscore params used in arrow body'
    },
    {
      code: 'class C { method(_val: number) { return _val; } }',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'underscore param used in class method'
    },
    {
      code: 'function foo(_x: number) { _x = 5; return _x; }',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'underscore param reassigned and read'
    }
  ],
  valid: [
    {
      code: 'function foo(_x: number) { return 1; }',
      name: 'underscore param genuinely unused'
    },
    {
      code: 'function foo(x: number) { return x + 1; }',
      name: 'non-underscore param used normally'
    },
    {
      code: 'const fn = (_a: string, b: number) => b;',
      name: 'underscore param unused alongside used param'
    },
    {
      code: 'function guard(_obj: unknown): asserts _obj is string { throw new Error(); }',
      name: 'underscore param referenced only in type predicate annotation'
    },
    {
      code: 'function foo() { const _local = 1; return _local; }',
      name: 'underscore local variable (not a param) is ignored'
    }
  ]
});
