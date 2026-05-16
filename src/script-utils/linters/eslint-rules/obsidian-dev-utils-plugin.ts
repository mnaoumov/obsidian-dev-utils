/**
 * @file
 *
 * ESLint plugin for Obsidian development utilities.
 */
import type { ESLint } from 'eslint';

import { noAsyncCallbackToUnsafeReturn } from './no-async-callback-to-unsafe-return.ts';
import { noUsedUnderscoreVariables } from './no-used-underscore-variables.ts';
import { paramsOptionsNameMatch } from './params-options-name-match.ts';
import { readonlyParamsOptionsMembers } from './readonly-params-options-members.ts';
import { requireSuperCall } from './require-super-call.ts';

export const obsidianDevUtilsPlugin: ESLint.Plugin = {
  rules: {
    'no-async-callback-to-unsafe-return': noAsyncCallbackToUnsafeReturn,
    'no-used-underscore-variables': noUsedUnderscoreVariables,
    'params-options-name-match': paramsOptionsNameMatch,
    'readonly-params-options-members': readonlyParamsOptionsMembers,
    'require-super-call': requireSuperCall
  }
};
