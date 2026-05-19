import { RuleTester } from '@typescript-eslint/rule-tester';
import {
  afterAll,
  describe,
  it
} from 'vitest';

import {
  MESSAGE_ID,
  preferNoopAsync
} from './prefer-noop-async.ts';
import { toRuleTesterModule } from './rule-tester-helper.ts';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester();

ruleTester.run('prefer-noop-async', toRuleTesterModule(preferNoopAsync), {
  invalid: [
    {
      code: 'await Promise.resolve();',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'await Promise.resolve() should be noopAsync()',
      output: 'await noopAsync();'
    },
    {
      code: 'const p = Promise.resolve();',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'Promise.resolve() assigned to variable',
      output: 'const p = noopAsync();'
    },
    {
      code: 'return Promise.resolve();',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'Promise.resolve() as return value',
      output: 'return noopAsync();'
    }
  ],
  valid: [
    {
      code: 'await noopAsync();',
      name: 'already using noopAsync()'
    },
    {
      code: 'Promise.resolve(42);',
      name: 'Promise.resolve with argument (not a no-op)'
    },
    {
      code: 'Promise.resolve("hello");',
      name: 'Promise.resolve with string argument'
    },
    {
      code: 'Promise.all([]);',
      name: 'Promise.all (not Promise.resolve, has arguments)'
    },
    {
      code: 'Promise.reject();',
      name: 'Promise.reject (not resolve)'
    },
    {
      code: 'MyPromise.resolve();',
      name: 'non-standard Promise.resolve (different identifier)'
    }
  ]
});
