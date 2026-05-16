import { RuleTester } from '@typescript-eslint/rule-tester';
import {
  afterAll,
  describe,
  it
} from 'vitest';

import {
  MESSAGE_ID,
  paramsOptionsNameMatch
} from './params-options-name-match.ts';
import { toRuleTesterModule } from './rule-tester-helper.ts';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester();

ruleTester.run('params-options-name-match', toRuleTesterModule(paramsOptionsNameMatch), {
  invalid: [
    {
      code: 'export function fooBar(params: WrongParams): void {}',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'exported function param type does not match function name'
    },
    {
      code: 'export const fooBar = (params: WrongParams): void => {};',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'exported arrow function param type does not match variable name'
    },
    {
      code: 'export class Foo { method(params: WrongParams): void {} }',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'public method param type does not match class + method name'
    },
    {
      code: 'export class Foo { method(params: MethodParams): void {} }',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'public method param type missing class name prefix'
    },
    {
      code: 'export class Foo { constructor(params: WrongConstructorParams) {} }',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'constructor param type does not match class name'
    },
    {
      code: 'export function fooBar(params: BazQuxParams): void {}',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'exported function param type has wrong prefix'
    },
    {
      code: 'export function fooBar(options: WrongOptions): void {}',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'exported function options type does not match function name'
    },
    {
      code: 'export class Foo { protected method(params: WrongParams): void {} }',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'protected method param type does not match'
    }
  ],
  valid: [
    {
      code: 'export function fooBar(params: FooBarParams): void {}',
      name: 'exported function param type matches function name with Params suffix'
    },
    {
      code: 'export function fooBar(options: FooBarOptions): void {}',
      name: 'exported function param type matches function name with Options suffix'
    },
    {
      code: 'export const fooBar = (params: FooBarParams): void => {};',
      name: 'exported arrow function param type matches variable name'
    },
    {
      code: 'export class Foo { method(params: FooMethodParams): void {} }',
      name: 'exported class public method param type matches ClassName + PascalCase(methodName) + Params'
    },
    {
      code: 'export class Foo { method(options: FooMethodOptions): void {} }',
      name: 'exported class public method options type matches ClassName + PascalCase(methodName) + Options'
    },
    {
      code: 'export class Foo { constructor(params: FooConstructorParams) {} }',
      name: 'exported class constructor param type matches ClassName + ConstructorParams'
    },
    {
      code: 'export class Foo { constructor(options: FooConstructorOptions) {} }',
      name: 'exported class constructor options type matches ClassName + ConstructorOptions'
    },
    {
      code: 'class Foo { constructor(params: WrongParams) {} }',
      name: 'non-exported class constructor is not checked'
    },
    {
      code: 'class Foo { method(params: WrongParams): void {} }',
      name: 'non-exported class method is not checked'
    },
    {
      code: 'export function fooBar(x: number): void {}',
      name: 'non-Params/Options type annotation is not checked'
    },
    {
      code: 'export function fooBar(x: number, y: string): void {}',
      name: 'primitive types are not checked'
    },
    {
      code: 'export const fn = (x: number) => x;',
      name: 'anonymous arrow with primitive type'
    },
    {
      code: '([1, 2, 3]).forEach((item) => {});',
      name: 'callback without name context is not checked'
    },
    {
      code: 'function fooBar(x): void {}',
      name: 'param without type annotation is not checked'
    },
    {
      code: 'export function fooBar(params: SomeCustomType): void {}',
      name: 'param type not ending in Params/Options is not checked'
    },
    {
      code: 'export function fooBar({ a, b }: FooBarParams): void {}',
      name: 'destructured param with type annotation is not checked due to structure'
    },
    {
      code: 'const obj = { method(params: MethodParams): void {} };',
      name: 'object method (no class context) is not checked'
    },
    {
      code: 'export default class { constructor(params: SomeConstructorParams) {} }',
      name: 'anonymous class constructor is not checked'
    },
    {
      code: 'function internal(params: SharedParams): void {}',
      name: 'non-exported function is not checked (passthrough pattern)'
    },
    {
      code: 'const internal = (params: SharedParams): void => {};',
      name: 'non-exported arrow function is not checked (passthrough pattern)'
    },
    {
      code: 'export class Foo { private helper(options: SharedOptions): void {} }',
      name: 'private method is not checked even in exported class'
    }
  ]
});
