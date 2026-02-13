/**
 * @packageDocumentation
 *
 * ESLint configuration.
 */

import type {
  ESLint,
  Linter
} from 'eslint';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Plugin is written for CommonJS.
import eslintPluginTsdocRequired_ = require('@guardian/eslint-plugin-tsdoc-required');
// eslint-disable-next-line import-x/no-rename-default, import-x/no-named-as-default -- The default export name `index` is too confusing.
import jsdoc from 'eslint-plugin-jsdoc';
import eslintPluginTsdoc from 'eslint-plugin-tsdoc';
import {
  defineConfig,
  globalIgnores
} from 'eslint/config';

import { join } from './src/Path.ts';
import {
  obsidianDevUtilsConfigs,
  typeScriptFiles
} from './src/ScriptUtils/ESLint/eslint.config.ts';
import { ObsidianDevUtilsRepoPaths } from './src/ScriptUtils/ObsidianDevUtilsRepoPaths.ts';

const eslintPluginTsdocRequired = eslintPluginTsdocRequired_ as ESLint.Plugin;

const testFiles = ['__tests__/**/*.ts', '__mocks__/**/*.ts'];

const configs: Linter.Config[] = defineConfig([
  globalIgnores([
    join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.IndexTs),
    ObsidianDevUtilsRepoPaths.DataviewTypes,
    join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyDts),
    `!${join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.Types, ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyDts)}`,
    ObsidianDevUtilsRepoPaths.Static
  ]),
  ...obsidianDevUtilsConfigs,
  {
    files: typeScriptFiles,
    plugins: {
      'eslint-plugin-tsdoc-required': eslintPluginTsdocRequired
    },
    rules: {
      'eslint-plugin-tsdoc-required/tsdoc-required': 'error'
    }
  },
  {
    files: typeScriptFiles,
    plugins: {
      tsdoc: eslintPluginTsdoc
    },
    rules: {
      'tsdoc/syntax': 'error'
    }
  },
  {
    ...jsdoc.configs['flat/recommended-typescript-error'],
    files: typeScriptFiles
  },
  {
    files: typeScriptFiles,
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
          contexts: [
            {
              context: 'ExportNamedDeclaration > FunctionDeclaration'
            },
            {
              context: 'ExportDefaultDeclaration > FunctionDeclaration'
            },
            {
              context: 'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression'
            },
            {
              context: 'ExportDefaultDeclaration > ArrowFunctionExpression'
            },
            {
              context: 'ExportNamedDeclaration MethodDefinition:not([accessibility="private"])'
            },
            {
              context: 'ExportDefaultDeclaration MethodDefinition:not([accessibility="private"])'
            },
            {
              context: 'ExportNamedDeclaration > ClassDeclaration > ClassBody > PropertyDefinition:not([accessibility=\'private\'])'
            },
            {
              context: 'ExportDefaultDeclaration > ClassDeclaration > ClassBody > PropertyDefinition:not([accessibility=\'private\'])'
            },
            {
              context: 'ExportNamedDeclaration > ClassDeclaration > ClassBody > TSAbstractPropertyDefinition:not([accessibility=\'private\'])'
            },
            {
              context: 'ExportDefaultDeclaration > ClassDeclaration > ClassBody > TSAbstractPropertyDefinition:not([accessibility=\'private\'])'
            }
          ],
          publicOnly: false,
          require: {
            ArrowFunctionExpression: false,
            ClassDeclaration: false,
            ClassExpression: false,
            FunctionDeclaration: false,
            MethodDefinition: false
          }
        }
      ],
      'jsdoc/require-throws-type': 'off',
      'jsdoc/tag-lines': [
        'error',
        'any',
        {
          startLines: 1
        }
      ]
    },
    settings: {
      jsdoc: {
        tagNamePreference: {
          template: 'typeParam'
        }
      }
    }
  },
  {
    files: testFiles,
    rules: {
      'eslint-plugin-tsdoc-required/tsdoc-required': 'off',
      'import-x/no-deprecated': 'off',
      'jsdoc/require-file-overview': 'off',
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-returns-description': 'off',
      'no-magic-numbers': 'off',
      'no-proto': 'off',
      'no-void': 'off',
      'obsidianmd/no-forbidden-elements': 'off',
      'obsidianmd/no-tfile-tfolder-cast': 'off',
      'perfectionist/sort-modules': 'off',
      'prefer-named-capture-group': 'off',
      'tsdoc/syntax': 'off'
    }
  }
]);

// eslint-disable-next-line import-x/no-default-export -- That is the way ESLint takes the config.
export default configs;
