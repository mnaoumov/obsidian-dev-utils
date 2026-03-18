/**
 * @packageDocumentation
 *
 * ESLint plugin for Obsidian development utilities.
 */
import type { ESLint } from 'eslint';

import { noUsedUnderscoreParams } from './no-used-underscore-params.ts';

export const obsidianDevUtilsPlugin: ESLint.Plugin = {
  rules: {
    'no-used-underscore-params': noUsedUnderscoreParams
  }
};
