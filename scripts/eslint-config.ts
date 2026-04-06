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
  defineEslintConfigs,
  EslintConfigContext
} from '../src/script-utils/linters/eslint-config.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/script-utils/obsidian-dev-utils-repo-paths.ts';

function getIgnoreConfigs(): Linter.Config[] {
  return defineConfig([
    globalIgnores([
      join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.IndexTs),
      ObsidianDevUtilsRepoPaths.DataviewTypes,
      join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyDts),
      join(ObsidianDevUtilsRepoPaths.Static, ObsidianDevUtilsRepoPaths.AnyPath)
    ])
  ]);
}

function getJsdocsConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig([
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
    }
  ]);
}

function getNoRestrictedSyntaxOverrideConfigs(): Linter.Config[] {
  return defineConfig([
    {
      files: [ObsidianDevUtilsRepoPaths.MarkdownlintTypesMarkdownlintCli2ConfigSchemaDts],
      rules: {
        'no-restricted-syntax': 'off'
      }
    }
  ]);
}

function getTsdocsConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig([
    {
      files: context.sourceFiles,
      ignores: context.testFiles,
      plugins: {
        tsdoc: eslintPluginTsdoc
      }
    }
  ]);
}

export const configs: Linter.Config[] = defineEslintConfigs({
  customConfigs(context) {
    return defineConfig([
      ...getIgnoreConfigs(),
      ...getTsdocsConfigs(context),
      ...getJsdocsConfigs(context),
      ...getNoRestrictedSyntaxOverrideConfigs(),
      {
        files: [ObsidianDevUtilsRepoPaths.PackageJson],
        rules: {
          'depend/ban-dependencies': ['error', { allowed: ['moment'] }]
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
