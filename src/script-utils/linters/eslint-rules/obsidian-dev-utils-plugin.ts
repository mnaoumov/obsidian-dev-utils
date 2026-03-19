/**
 * @packageDocumentation
 *
 * ESLint plugin for Obsidian development utilities.
 */
import type { ESLint } from 'eslint';

import { noAsyncCallbackToAnyReturn } from './no-async-callback-to-any-return.ts';
import { noUsedUnderscoreParams } from './no-used-underscore-params.ts';

export const obsidianDevUtilsPlugin: ESLint.Plugin = {
  rules: {
    'no-async-callback-to-any-return': noAsyncCallbackToAnyReturn,
    'no-used-underscore-params': noUsedUnderscoreParams
  }
};
