import type {
  ESLint,
  Linter
} from 'eslint';

import eslintPluginTsdocRequired_ = require('@guardian/eslint-plugin-tsdoc-required');
import eslintPluginTsdoc from 'eslint-plugin-tsdoc';
import eslintPluginVerifyTsdoc from 'eslint-plugin-verify-tsdoc';

import { join } from './src/Path.ts';
import { configs as defaultConfigs } from './src/ScriptUtils/ESLint/eslint.config.ts';
import { ObsidianDevUtilsRepoPaths } from './src/ScriptUtils/ObsidianDevUtilsRepoPaths.ts';

const eslintPluginTsdocRequired = eslintPluginTsdocRequired_ as ESLint.Plugin;

const configs: Linter.Config[] = [
  ...defaultConfigs,
  {
    ignores: [
      join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.IndexTs),
      ObsidianDevUtilsRepoPaths.DataviewTypes,
      join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyDts),
      `!${join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.Types, ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyDts)}`
    ]
  },
  {
    plugins: {
      'eslint-plugin-tsdoc-required': eslintPluginTsdocRequired
    },
    rules: {
      'eslint-plugin-tsdoc-required/tsdoc-required': 'error'
    }
  },
  {
    plugins: {
      'tsdoc': eslintPluginTsdoc
    },
    rules: {
      'tsdoc/syntax': 'error'
    }
  },
  {
    plugins: {
      'verify-tsdoc': eslintPluginVerifyTsdoc
    },
    rules: {
      'verify-tsdoc/verify-tsdoc-params': 'error'
    }
  }
];

export default configs;
