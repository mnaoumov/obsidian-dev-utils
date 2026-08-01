import { RuleTester } from '@typescript-eslint/rule-tester';
import {
  afterAll,
  describe,
  it
} from 'vitest';

import {
  kebabCaseFileName,
  MESSAGE_ID
} from './kebab-case-file-name.ts';
import { toRuleTesterModule } from './rule-tester-helper.ts';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester();

ruleTester.run('kebab-case-file-name', toRuleTesterModule(kebabCaseFileName), {
  invalid: [
    {
      code: 'export const a = 1;',
      errors: [{ data: { name: 'App' }, messageId: MESSAGE_ID }],
      filename: '/repo/src/App.ts',
      name: 'PascalCase'
    },
    {
      code: 'export const a = 1;',
      errors: [{ data: { name: 'createDiv' }, messageId: MESSAGE_ID }],
      filename: '/repo/src/createDiv.ts',
      name: 'camelCase'
    },
    {
      code: 'export const a = 1;',
      errors: [{ data: { name: 'snake_case' }, messageId: MESSAGE_ID }],
      filename: '/repo/src/snake_case.ts',
      name: 'snake_case'
    },
    {
      code: 'export const a = 1;',
      errors: [{ data: { name: '__merged' }, messageId: MESSAGE_ID }],
      filename: '/repo/src/__merged.ts',
      name: 'leading underscores'
    },
    {
      code: 'export const a = 1;',
      errors: [{ data: { name: 'double--hyphen' }, messageId: MESSAGE_ID }],
      filename: '/repo/src/double--hyphen.ts',
      name: 'doubled hyphen'
    },
    {
      code: 'export const a = 1;',
      errors: [{ data: { name: '-leading' }, messageId: MESSAGE_ID }],
      filename: '/repo/src/-leading.ts',
      name: 'leading hyphen'
    },
    {
      code: 'export const a = 1;',
      errors: [{ data: { name: 'trailing-' }, messageId: MESSAGE_ID }],
      filename: '/repo/src/trailing-.ts',
      name: 'trailing hyphen'
    },
    {
      // Only the STEM is judged, so a bad stem is still reported however many suffixes follow it.
      code: 'export const a = 1;',
      errors: [{ data: { name: 'MyThing' }, messageId: MESSAGE_ID }],
      filename: '/repo/src/MyThing.obsidian.integration.test.ts',
      name: 'bad stem behind several suffixes'
    },
    {
      code: 'export const a = 1;',
      errors: [{ data: { name: 'App' }, messageId: MESSAGE_ID }],
      filename: 'C:\\repo\\src\\App.ts',
      name: 'Windows path separators'
    },
    {
      // A dotfile still has a real name behind its leading dot, so it is judged rather than skipped.
      code: 'export const a = 1;',
      errors: [{ data: { name: 'NanoStaged' }, messageId: MESSAGE_ID }],
      filename: '/repo/.NanoStaged.mjs',
      name: 'dotfile with a non-kebab name'
    }
  ],
  valid: [
    {
      code: 'export const a = 1;',
      filename: '/repo/src/plugin.ts',
      name: 'single lowercase word'
    },
    {
      code: 'export const a = 1;',
      filename: '/repo/src/syntax-highlighting-component.ts',
      name: 'hyphenated words'
    },
    {
      code: 'export const a = 1;',
      filename: '/repo/src/obsidian-1-13-4.ts',
      name: 'digits between hyphens'
    },
    {
      // Every suffix combination reduces to the same stem, so none of them needs listing.
      code: 'export const a = 1;',
      filename: '/repo/src/markdown-parser.test.ts',
      name: 'test suffix'
    },
    {
      code: 'export const a = 1;',
      filename: '/repo/src/markdown-parser.d.ts',
      name: 'declaration suffix'
    },
    {
      code: 'export const a = 1;',
      filename: '/repo/src/edit-link.obsidian.integration.test.ts',
      name: 'multi-part suffix'
    },
    {
      code: 'export const a = 1;',
      filename: '/repo/vitest.config.ts',
      name: 'config file, whose stem is already kebab-case'
    },
    {
      code: 'export const a = 1;',
      filename: 'C:\\repo\\src\\syntax-highlighting-component.ts',
      name: 'Windows path separators'
    },
    {
      // The leading dot is the dotfile convention, not part of the name; every plugin in the workspace
      // Ships these two, so getting it wrong would fail the whole fleet.
      code: 'export const a = 1;',
      filename: '/repo/.markdownlint-cli2.mjs',
      name: 'dotfile with a kebab-case name'
    },
    {
      code: 'export const a = 1;',
      filename: '/repo/.nano-staged.mjs',
      name: 'another shipped dotfile'
    },
    {
      // ESLint's placeholder when linting a string rather than a file — there is no name to judge.
      code: 'export const a = 1;',
      filename: '<input>',
      name: 'the no-file placeholder'
    }
  ]
});
