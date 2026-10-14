import { RuleTester } from '@typescript-eslint/rule-tester';
import {
  afterAll,
  describe,
  it,
  vi
} from 'vitest';

import {
  MESSAGE_ID,
  noUnresolvedJsdocLink
} from './no-unresolved-jsdoc-link.ts';
import { toRuleTesterModule } from './rule-tester-helper.ts';

const TYPE_CHECK_TIMEOUT_IN_MILLISECONDS = 60_000;

vi.setConfig({ testTimeout: TYPE_CHECK_TIMEOUT_IN_MILLISECONDS });

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ['*.ts'],
        defaultProject: 'tsconfig.eslint-test.json'
      }
    }
  }
});

ruleTester.run('no-unresolved-jsdoc-link', toRuleTesterModule(noUnresolvedJsdocLink), {
  invalid: [
    {
      code: `
        /** See {@link Missing}. */
        export const value = 1;
      `,
      errors: [{ column: 24, data: { name: 'Missing' }, endColumn: 31, line: 2, messageId: MESSAGE_ID }],
      name: 'unknown identifier'
    },
    {
      code: `
        /** See {@linkcode Missing} and {@linkplain AlsoMissing}. */
        export const value = 1;
      `,
      errors: [
        { data: { name: 'Missing' }, messageId: MESSAGE_ID },
        { data: { name: 'AlsoMissing' }, messageId: MESSAGE_ID }
      ],
      name: 'linkcode and linkplain are checked too'
    },
    {
      code: `
        export class Bar {
          public baz = 1;
        }
        /** See {@link Bar.nope} and {@link Bar.nope.deeper}. */
        export const value = 1;
      `,
      errors: [
        { data: { name: 'Bar.nope' }, messageId: MESSAGE_ID },
        { data: { name: 'Bar.nope.deeper' }, messageId: MESSAGE_ID }
      ],
      name: 'qualified name with an unknown member'
    },
    {
      code: `
        export class Bar {
          public baz = 1;
        }
        /** See {@link Bar#nope}. */
        export const value = 1;
      `,
      errors: [{ data: { name: 'Bar#nope' }, messageId: MESSAGE_ID }],
      name: 'member name with an unknown member'
    },
    {
      code: `
        /** See {@link Nope.a}. */
        export const value = 1;
      `,
      errors: [{ data: { name: 'Nope.a' }, messageId: MESSAGE_ID }],
      name: 'qualified name with an unknown root'
    },
    {
      code: `
        export function outer(): void {
          /**
           * Nested {@link Gone}.
           */
          const inner = (): void => {};
          inner();
        }
      `,
      errors: [{ data: { name: 'Gone' }, messageId: MESSAGE_ID }],
      name: 'link in a nested declaration'
    },
    {
      code: `
        /**
         * Does a thing.
         *
         * @param value - See {@link Gone}.
         * @returns See {@link AlsoGone}.
         */
        export function f(value: number): number {
          return value;
        }
      `,
      errors: [
        { data: { name: 'Gone' }, messageId: MESSAGE_ID },
        { data: { name: 'AlsoGone' }, messageId: MESSAGE_ID }
      ],
      name: 'links inside tags are reported once each'
    },
    {
      code: `
        /** See {@link missing!Foo}, {@link typescript!NoSuchExport} and {@link typescript!SyntaxKind.NoSuchMember}. */
        export const value = 1;
      `,
      errors: [
        { data: { name: 'missing!Foo' }, messageId: MESSAGE_ID },
        { data: { name: 'typescript!NoSuchExport' }, messageId: MESSAGE_ID },
        { data: { name: 'typescript!SyntaxKind.NoSuchMember' }, messageId: MESSAGE_ID }
      ],
      name: 'module path forms with an unknown module or export'
    },
    {
      code: `
        /** See {@link lib.es5!Anything}. */
        export const value = 1;
      `,
      errors: [{ data: { name: 'lib.es5!Anything' }, messageId: MESSAGE_ID }],
      name: 'module path matching a global script file, which has no exports'
    },
    {
      code: `
        /** See {@link typescript#NoSuchExport}. */
        export const value = 1;
      `,
      errors: [{ data: { name: 'typescript#NoSuchExport' }, messageId: MESSAGE_ID }],
      name: 'package member form with an unknown export'
    },
    {
      code: `
        /** See {@link import('./nope.ts').Foo} and {@link import("typescript").NoSuchExport}. */
        export const value = 1;
      `,
      errors: [
        { data: { name: 'import(\'./nope.ts\').Foo' }, messageId: MESSAGE_ID },
        { data: { name: 'import("typescript").NoSuchExport' }, messageId: MESSAGE_ID }
      ],
      name: 'import type form with an unknown module or export'
    }
  ],
  valid: [
    {
      code: `
        export class Bar {
          public baz = 1;
          public qux(): void {}
        }
        /** See {@link Bar}, {@link Bar.baz}, {@link Bar#qux} and {@link Bar | the bar}. */
        export const value = 1;
      `,
      name: 'local class, its members and a labelled link'
    },
    {
      code: `
        /** See {@link Promise}, {@link ProxyHandler} and {@link Math.max}. */
        export const value = 1;
      `,
      name: 'ES globals'
    },
    {
      code: `
        /**
         * Generic.
         *
         * @param settings - A {@link PluginSettings} value, see {@link settings}.
         */
        export function f<PluginSettings>(settings: PluginSettings): void {
          void settings;
        }
      `,
      name: 'type parameter and parameter names'
    },
    {
      code: `
        import type { RuleTester } from '@typescript-eslint/rule-tester';
        /** See {@link RuleTester}. */
        export type Alias = RuleTester;
      `,
      name: 'imported type'
    },
    {
      code: `
        /** See {@link https://example.com}, {@link module:foo} and {@link}. */
        export const value = 1;
      `,
      name: 'URL, namepath and name-less links are skipped'
    },
    {
      code: `
        /** Plain comment with no links. */
        export const value = 1;
        // {@link NotJsDoc}
      `,
      name: 'non-JSDoc comments are ignored'
    },
    {
      code: `
        /**
         * Parameters for {@link inner}.
         */
        interface InnerParams {
          readonly value: number;
        }
        export function outer(): void {
          function inner(params: InnerParams): void {
            void params;
          }
          inner({ value: 1 });
        }
      `,
      name: 'function nested in another function, declared further down the file'
    },
    {
      code: `
        /** See {@link Holder.run}, which is private. */
        export const value = 1;
        export class Holder {
          private run(): void {}
        }
      `,
      name: 'private member of a class in the same file'
    },
    {
      code: `
        class Holder {
          public run(): void {}
        }
        /** See {@link Renamed.run}. */
        export const value = 1;
        export { Holder as Renamed };
      `,
      name: 'member of a re-exported alias, which no local binding names'
    },
    {
      code: `
        interface Vault {
          adapter: number;
        }
        export class App {
          public vault!: Vault;
        }
        /** See {@link App.vault.adapter}. */
        export const value = 1;
      `,
      name: 'member of a member type'
    },
    {
      code: `
        import type { SyntaxKind } from 'typescript';
        /**
         * See {@link TypeChecker}, {@link typescript!SyntaxKind.Identifier}, {@link typescript#SyntaxKind},
         * {@link lib/typescript!SyntaxKind}, {@link lib/typescript!TypeChecker.getTypeAtLocation},
         * {@link import('typescript').SyntaxKind} and {@link import('../typescript/lib/typescript.d.ts').SyntaxKind}.
         */
        export type Kind = SyntaxKind;
      `,
      name: 'export of a module in the program that is not imported, and the module path forms'
    },
    {
      code: `
        declare module 'ambient' {
          export const a: number;
        }
        /** See {@link ambient!a} and {@link ambient#a}. */
        declare const value: number;
      `,
      name: 'ambient module'
    }
  ]
});
