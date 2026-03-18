import type { Linter } from 'eslint';

// eslint-disable-next-line import-x/no-rename-default, import-x/no-named-as-default -- The default export name `index` is too confusing.
import jsdoc from 'eslint-plugin-jsdoc';
import eslintPluginTsdoc from 'eslint-plugin-tsdoc';
import {
  defineConfig,
  globalIgnores
} from 'eslint/config';

import { join } from '../src/path.ts';
import { defineEslintConfigs } from '../src/script-utils/linters/eslint-config.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/script-utils/obsidian-dev-utils-repo-paths.ts';

const noRestrictedSyntaxRules: Linter.RuleEntry = [
  'error',
  {
    message: 'Do not use definite assignment assertions (!). Initialize the field or make it optional (G10e).',
    selector: 'PropertyDefinition[definite=true]'
  },
  {
    message: 'Do not use definite assignment assertions (!) on abstract fields (G10e).',
    selector: 'TSAbstractPropertyDefinition[definite=true]'
  },
  {
    message: 'Do not use double type assertions (as X as Y). Use strictProxy<T>() or ensureGenericObject() instead (G10e).',
    selector: 'TSAsExpression > TSAsExpression'
  },
  {
    message: 'Do not use _ prefix on methods or functions. The _ prefix is for unused parameters only (G10e).',
    selector: 'MethodDefinition[key.name=/^_/]'
  },
  {
    message: 'Do not use _ prefix on methods or functions. The _ prefix is for unused parameters only (G10e).',
    selector: 'FunctionDeclaration[id.name=/^_/]'
  },
  {
    message: 'Do not rename imports with "Mock" in the alias. Mock classes are the canonical types — use the original name.',
    selector: 'ImportSpecifier[local.name=/Mock/]:not([imported.name=/Mock/])'
  },
  {
    message: 'Avoid dynamic import(). Use static imports instead. Only use dynamic imports for lazy/conditional loading (G10a).',
    selector: 'ImportExpression'
  }
];

export const configs: Linter.Config[] = defineEslintConfigs({
  customConfigs(context) {
    return defineConfig([
      globalIgnores([
        join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.IndexTs),
        ObsidianDevUtilsRepoPaths.DataviewTypes,
        join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyDts),
        `!${join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.Types, ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyDts)}`,
        ObsidianDevUtilsRepoPaths.Static
      ]),
      {
        files: context.sourceFiles,
        ignores: context.testFiles,
        plugins: {
          tsdoc: eslintPluginTsdoc
        },
        rules: {
          'tsdoc/syntax': 'error'
        }
      },
      {
        files: context.allFiles(),
        rules: {
          'no-restricted-syntax': noRestrictedSyntaxRules
        }
      },
      {
        ...jsdoc.configs['flat/recommended-typescript-error'],
        files: context.sourceFiles,
        ignores: context.testFiles
      },
      {
        files: context.sourceFiles,
        ignores: context.testFiles,
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
        files: [ObsidianDevUtilsRepoPaths.PackageJson],
        rules: {
          'depend/ban-dependencies': ['error', { allowed: ['moment'] }]
        }
      },
      {
        files: context.testFiles,
        rules: {
          '@typescript-eslint/no-unsafe-argument': 'off',
          '@typescript-eslint/no-unsafe-assignment': 'off',
          '@typescript-eslint/no-unsafe-call': 'off',
          '@typescript-eslint/no-unsafe-member-access': 'off',
          '@typescript-eslint/unbound-method': 'off',
          'no-magic-numbers': 'off'
        }
      },
      {
        files: [ObsidianDevUtilsRepoPaths.MarkdownlintTypesMarkdownlintCli2ConfigSchemaDts],
        rules: {
          'no-restricted-syntax': 'off'
        }
      }
    ]);
  },

  editContext(context) {
    context.testFiles.push(
      join(ObsidianDevUtilsRepoPaths.Src, ObsidianDevUtilsRepoPaths.TestHelpers, ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyTs)
    );
    context.scriptFiles.push(
      join(ObsidianDevUtilsRepoPaths.Src, ObsidianDevUtilsRepoPaths.ScriptUtils, ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyTs)
    );
  }
});
