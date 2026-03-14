import type { Linter } from 'eslint';

// eslint-disable-next-line import-x/no-rename-default, import-x/no-named-as-default -- The default export name `index` is too confusing.
import jsdoc from 'eslint-plugin-jsdoc';
import eslintPluginTsdoc from 'eslint-plugin-tsdoc';
import {
  defineConfig,
  globalIgnores
} from 'eslint/config';

import { join } from '../src/path.ts';
import {
  obsidianDevUtilsConfigs,
  typeScriptFiles
} from '../src/script-utils/linters/eslint-config.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/script-utils/obsidian-dev-utils-repo-paths.ts';

const testFiles = ['src/**/*.test.ts', 'src/test-helpers.ts', '__mocks__/**/*.ts'];
const rootScriptFiles = ['commitlint.config.ts', 'eslint.config.mts'];
const scriptFiles = [
  ...rootScriptFiles,
  'scripts/**/*.ts'
];

export const configs: Linter.Config[] = defineConfig([
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
            },
            {
              context: 'ExportNamedDeclaration > TSInterfaceDeclaration'
            },
            {
              context: 'ExportNamedDeclaration > TSTypeAliasDeclaration'
            },
            {
              context: 'ExportNamedDeclaration > TSEnumDeclaration'
            },
            {
              context: 'ExportNamedDeclaration > ClassDeclaration'
            },
            {
              context: 'ExportDefaultDeclaration > ClassDeclaration'
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
    files: ['package.json'],
    rules: {
      'depend/ban-dependencies': ['error', { allowed: ['moment'] }]
    }
  },
  {
    files: scriptFiles,
    rules: {
      'jsdoc/require-file-overview': 'off'
    }
  },
  {
    files: testFiles,
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'jsdoc/require-file-overview': 'off',
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-returns-description': 'off',
      'no-magic-numbers': 'off',
      'no-restricted-syntax': 'off',
      'tsdoc/syntax': 'off'
    }
  },
  {
    files: rootScriptFiles,
    rules: {
      'import-x/no-default-export': 'off'
    }
  }
]);
