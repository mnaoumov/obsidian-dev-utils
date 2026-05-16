import { RuleTester } from '@typescript-eslint/rule-tester';
import {
  afterAll,
  describe,
  it
} from 'vitest';

import {
  MESSAGE_ID,
  readonlyParamsOptionsMembers
} from './readonly-params-options-members.ts';
import { toRuleTesterModule } from './rule-tester-helper.ts';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester();

ruleTester.run('readonly-params-options-members', toRuleTesterModule(readonlyParamsOptionsMembers), {
  invalid: [
    {
      code: 'interface FooParams { bar: string; }',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'non-readonly property in *Params interface',
      output: 'interface FooParams { readonly bar: string; }'
    },
    {
      code: 'interface FooOptions { bar: string; }',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'non-readonly property in *Options interface',
      output: 'interface FooOptions { readonly bar: string; }'
    },
    {
      code: 'interface FooParams { readonly a: string; b: number; }',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'mixed readonly and non-readonly in *Params',
      output: 'interface FooParams { readonly a: string; readonly b: number; }'
    },
    {
      code: 'interface FooParams { a: string; b: number; }',
      errors: [
        { messageId: MESSAGE_ID },
        { messageId: MESSAGE_ID }
      ],
      name: 'multiple non-readonly properties in *Params',
      output: 'interface FooParams { readonly a: string; readonly b: number; }'
    },
    {
      code: 'type BarOptions = { baz: boolean; };',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'non-readonly property in *Options type alias',
      output: 'type BarOptions = { readonly baz: boolean; };'
    },
    {
      code: 'interface ConstructorParams extends BaseParams { extra: string; }',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'non-readonly property in extended *Params interface',
      output: 'interface ConstructorParams extends BaseParams { readonly extra: string; }'
    }
  ],
  valid: [
    {
      code: 'interface FooParams { readonly bar: string; }',
      name: 'all readonly in *Params interface'
    },
    {
      code: 'interface FooOptions { readonly bar: string; readonly baz: number; }',
      name: 'all readonly in *Options interface'
    },
    {
      code: 'interface Foo { bar: string; }',
      name: 'non-Params/Options interface is not checked'
    },
    {
      code: 'interface FooResult { bar: string; }',
      name: 'interface ending in Result is not checked'
    },
    {
      code: 'type BarOptions = { readonly baz: boolean; };',
      name: 'all readonly in *Options type alias'
    },
    {
      code: 'interface EmptyParams {}',
      name: 'empty *Params interface is valid'
    }
  ]
});
