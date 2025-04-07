/**
 * @packageDocumentation
 *
 * ESLint configuration.
 */

import type {
  ESLint,
  Linter
} from 'eslint';

// eslint-disable-next-line import-x/no-rename-default
import jsdoc from 'eslint-plugin-jsdoc';
import eslintPluginTsdoc from 'eslint-plugin-tsdoc';

import { join } from './src/Path.ts';
import { configs as defaultConfigs } from './src/ScriptUtils/ESLint/eslint.config.ts';
import { ObsidianDevUtilsRepoPaths } from './src/ScriptUtils/ObsidianDevUtilsRepoPaths.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports
import eslintPluginTsdocRequired_ = require('@guardian/eslint-plugin-tsdoc-required');

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
      tsdoc: eslintPluginTsdoc
    },
    rules: {
      'tsdoc/syntax': 'error'
    }
  },
  jsdoc.configs['flat/recommended-typescript-error'],
  {
    plugins: {
      jsdoc
    },
    rules: {
      'jsdoc/check-tag-names': [
        'error',
        {
          definedTags: [
            'packageDocumentation',
            'remarks',
            'typeParam'
          ]
        }
      ],
      'jsdoc/require-file-overview': [
        'error',
        {
          tags: {
            packageDocumentation: {
              initialCommentsOnly: true,
              mustExist: true,
              preventDuplicates: true
            }
          }
        }
      ],
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: {
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
            ClassExpression: true,
            FunctionDeclaration: true,
            MethodDefinition: true
          }
        }
      ],
      'jsdoc/tag-lines': [
        'error',
        'any',
        {
          startLines: 1
        }
      ]
    }
  }
];

// eslint-disable-next-line import-x/no-default-export
export default configs;
