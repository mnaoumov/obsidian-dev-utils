/**
 * @file
 *
 * ESLint configuration.
 */

import type { Linter } from 'eslint';

// eslint-disable-next-line import-x/no-rename-default, import-x/no-named-as-default -- The default export name `index` is too confusing.
import jsdoc from 'eslint-plugin-jsdoc';
// eslint-disable-next-line import-x/no-rename-default -- The default export name `plugin` is too confusing.
import obsidianmd from 'eslint-plugin-obsidianmd';
import eslintPluginTsdoc from 'eslint-plugin-tsdoc';
import {
  defineConfig,
  globalIgnores
} from 'eslint/config';

import { join } from '../src/path.ts';
import { agnosticCoreBoundaryNoRestrictedImportPatterns } from '../src/script-utils/linters/eslint-agnostic-core-boundary.ts';
import {
  defineEslintConfigs,
  EslintConfigContext
} from '../src/script-utils/linters/eslint-config.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/script-utils/obsidian-dev-utils-repo-paths.ts';

function getAgnosticCoreBoundaryConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig([
    {
      // Scoped to the agnostic top-level `src/*.ts` modules only.
      // Nested layers (`src/obsidian/**`, `src/script-utils/**`), the generated barrel, and test files are excluded.
      files: [join(ObsidianDevUtilsRepoPaths.Src, ObsidianDevUtilsRepoPaths.AnyTs)],
      ignores: [
        join(ObsidianDevUtilsRepoPaths.Src, ObsidianDevUtilsRepoPaths.IndexTs),
        ...context.testFiles
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [...agnosticCoreBoundaryNoRestrictedImportPatterns]
          }
        ]
      }
    }
  ]);
}

function getDependConfigs(): Linter.Config[] {
  return defineConfig({
    files: [ObsidianDevUtilsRepoPaths.PackageJson],
    rules: {
      'depend/ban-dependencies': ['error', { allowed: ['moment'] }]
    }
  });
}

function getIgnoreConfigs(): Linter.Config[] {
  return defineConfig([
    globalIgnores([
      join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.IndexTs),
      join(ObsidianDevUtilsRepoPaths.Src, ObsidianDevUtilsRepoPaths.MergedTs),
      ObsidianDevUtilsRepoPaths.DataviewTypes,
      join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyDts),
      join(ObsidianDevUtilsRepoPaths.Templates, ObsidianDevUtilsRepoPaths.AnyPath),
      // Self-contained Astro + Starlight documentation site: the root `astro.config.ts`, the `docs/` tree,
      // `scripts/docs-gen` generator. `astro build` validates it, not this repo's ESLint.
      ObsidianDevUtilsRepoPaths.AstroConfigTs,
      join(ObsidianDevUtilsRepoPaths.Docs, ObsidianDevUtilsRepoPaths.AnyPath),
      join(ObsidianDevUtilsRepoPaths.Scripts, 'docs-gen', ObsidianDevUtilsRepoPaths.AnyPath)
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
              'remarks',
              'typeParam'
            ]
          }
        ],
        'jsdoc/check-template-names': 'error',
        /*
         * Empty JSDoc blocks are never a valid substitute for real documentation, regardless of how they appear
         * (hand-written or inserted by `jsdoc/require-jsdoc`'s autofix as a placeholder). `enableFixer: false` keeps
         * the empty block in place and reports it, forcing a real description to be written instead of silently
         * deleting the placeholder and re-triggering `require-jsdoc`.
         */
        'jsdoc/no-blank-blocks': ['error', { enableFixer: false }],
        'jsdoc/require-description': 'error',
        'jsdoc/require-file-overview': [
          'error',
          {
            tags: {
              file: {
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
        'jsdoc/require-template': 'error',
        'jsdoc/require-template-description': 'error',
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

function getObsidianLintConfigs(): Linter.Config[] {
  return defineConfig([
    {
      plugins: {
        obsidianmd
      },
      rules: {
        'eslint-comments/no-restricted-disable': 'off'
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
      ...getAgnosticCoreBoundaryConfigs(context),
      ...getDependConfigs(),
      ...getObsidianLintConfigs()
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
