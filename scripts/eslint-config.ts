/**
 * @file
 *
 * ESLint configuration.
 */

import type { Linter } from 'eslint';

import {
  defineEslintConfigs,
  EslintConfigContext
} from '@mnaoumov/obsidian-dev-toolkit/linters/eslint-config';
import { getPackageBoundaryNoRestrictedImportPatterns } from '@mnaoumov/typescript-dev-toolkit/linters/eslint-agnostic-core-boundary';
import { RepoPaths } from '@mnaoumov/typescript-dev-toolkit/repo-paths';
import { getRootFolder } from '@mnaoumov/typescript-dev-toolkit/root';
import { join } from '@mnaoumov/typescript-lib/path';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
// eslint-disable-next-line import-x/no-rename-default -- The default export name `plugin` is too confusing.
import astro from 'eslint-plugin-astro';
// eslint-disable-next-line import-x/no-rename-default, import-x/no-named-as-default -- The default export name `index` is too confusing.
import jsdoc from 'eslint-plugin-jsdoc';
// eslint-disable-next-line import-x/no-rename-default -- The default export name `plugin` is too confusing.
import obsidianmd from 'eslint-plugin-obsidianmd';
import eslintPluginTsdoc from 'eslint-plugin-tsdoc';
import {
  defineConfig,
  globalIgnores
} from 'eslint/config';

import { WorkspaceRepoPaths } from './helpers/workspace-repo-paths.ts';

/**
 * What each workspace package's NON-TEST code may not import. The arrows point one way: generic code imports
 * nothing of ours; the generic test support and tooling import generic code; Obsidian code imports generic code;
 * Obsidian tooling imports any of them. Nothing imports the test support except tests and the test-setup endpoints.
 */
const FORBIDDEN_WORKSPACE_IMPORTS: Readonly<Record<string, readonly string[]>> = {
  'obsidian-dev-toolkit': ['typescript-test-toolkit'],
  'obsidian-lib': ['obsidian-dev-toolkit', 'typescript-dev-toolkit', 'typescript-test-toolkit'],
  'typescript-dev-toolkit': ['obsidian-dev-toolkit', 'obsidian-lib', 'typescript-test-toolkit'],
  'typescript-lib': ['obsidian-dev-toolkit', 'obsidian-lib', 'typescript-dev-toolkit', 'typescript-test-toolkit'],
  'typescript-test-toolkit': ['obsidian-dev-toolkit', 'obsidian-lib', 'typescript-dev-toolkit']
};

const PACKAGE_SCOPE = '@mnaoumov';

const RUNTIME_PACKAGE_FOLDERS = ['typescript-lib', 'obsidian-lib'];

const SOURCE_CONDITION = '@mnaoumov/source';

const WORKSPACE_PACKAGES_FOLDER = 'packages';

const TOOLING_PACKAGE_FOLDERS = ['typescript-dev-toolkit', 'obsidian-dev-toolkit'];

function getAstroConfigs(): Linter.Config[] {
  // eslint-disable-next-line import-x/no-named-as-default-member -- `configs` is the plugin's configuration namespace.
  return defineConfig(astro.configs.recommended);
}

function getAstroConfigTypeCheckingConfigs(): Linter.Config[] {
  return defineConfig({
    files: [WorkspaceRepoPaths.AstroConfigTs],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.astro.json',
        projectService: false,
        // eslint-disable-next-line unicorn/name-replacements -- `tsconfigRootDir` is a `typescript-eslint` parser option.
        tsconfigRootDir: getRootFolder() ?? ''
      }
    }
  });
}

function getDependConfigs(): Linter.Config[] {
  return defineConfig({
    files: [RepoPaths.PackageJson],
    rules: {
      'depend/ban-dependencies': ['error', { allowed: ['moment'] }]
    }
  });
}

function getIgnoreConfigs(): Linter.Config[] {
  return defineConfig([
    globalIgnores([
      join(RepoPaths.AnyPath, RepoPaths.IndexTs),
      join(RepoPaths.AnyPath, WorkspaceRepoPaths.MergedTs),
      WorkspaceRepoPaths.DataviewTypes,
      join(RepoPaths.AnyPath, RepoPaths.AnyDts),
      join(WORKSPACE_PACKAGES_FOLDER, RepoPaths.Any, RepoPaths.Templates, RepoPaths.AnyPath)
    ])
  ]);
}

function getJsdocsConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig([
    {
      // eslint-disable-next-line import-x/no-named-as-default-member -- `configs` is the plugin's configuration namespace.
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
        /*
         * Inherited from `flat/recommended-typescript-error`, restated here to record that it is kept deliberately
         * and not disabled: it forbids a valued `@default` and a `@param foo=5` default in function-shaped contexts, which is
         * exactly the boundary that is wanted — the tag documents a type member, whose declaration cannot show its
         * default, and never a parameter, whose initializer already does. Both checks share the rule's single
         * `contexts` list, so keeping either means keeping both. Note the autofix STRIPS the tag's value rather than
         * reporting it, so `--fix` would silently delete such a doc.
         */
        'jsdoc/no-defaults': 'error',
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
      files: [WorkspaceRepoPaths.MarkdownlintTypesMarkdownlintCli2ConfigSchemaDts],
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
    },
    {
      /*
       * The root `manifest.json` is a stub saying `isDesktopOnly: true`, which the rule reads by default, so it skipped
       * every file here. The two runtime packages also run on Obsidian mobile, whose iOS floor (15) has no lookbehind.
       */
      files: RUNTIME_PACKAGE_FOLDERS.map((packageFolder) => join(WORKSPACE_PACKAGES_FOLDER, packageFolder, RepoPaths.Src, RepoPaths.AnyPath, RepoPaths.AnyTs)),
      rules: {
        'obsidianmd/regex-lookbehind': ['error', { isDesktopOnly: false }]
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

function getWorkspaceBoundaryConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig(
    Object.entries(FORBIDDEN_WORKSPACE_IMPORTS).map(([packageFolder, forbiddenPackageFolders]) => ({
      files: [join(WORKSPACE_PACKAGES_FOLDER, packageFolder, RepoPaths.Src, RepoPaths.AnyPath, RepoPaths.AnyTs)],
      ignores: [
        ...context.testFiles,
        // The test-setup endpoints are test support themselves, so they may build on the generic one.
        join(WORKSPACE_PACKAGES_FOLDER, packageFolder, RepoPaths.Src, RepoPaths.AnyPath, 'setup.ts'),
        join(WORKSPACE_PACKAGES_FOLDER, packageFolder, RepoPaths.Src, RepoPaths.AnyPath, '*-setup.ts')
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: getPackageBoundaryNoRestrictedImportPatterns({
              forbiddenPackageNames: forbiddenPackageFolders.map((forbiddenPackageFolder) => `${PACKAGE_SCOPE}/${forbiddenPackageFolder}`),
              packageName: `${PACKAGE_SCOPE}/${packageFolder}`
            })
          }
        ]
      }
    }))
  );
}

function getWorkspaceImportResolutionConfigs(): Linter.Config[] {
  return defineConfig([
    {
      settings: {
        /*
         * The shared config's resolver, plus the `@mnaoumov/source` condition, so `@mnaoumov/<package>/<subpath>`
         * resolves to the sibling package's source, exactly as `tsc` resolves it here. Without it the resolver
         * follows the `types` condition into `dist/`, which is stale or missing for whatever changed since the last
         * build. Kept out of the shared config: in a consumer the condition would point at sources that do not ship.
         */
        'import-x/resolver-next': [
          createTypeScriptImportResolver({
            alwaysTryTypes: true,
            conditionNames: [SOURCE_CONDITION, 'types', 'import', 'esm2020', 'es2020', 'es2015', 'require', 'node', 'node-addons', 'browser', 'default']
          })
        ]
      }
    },
    {
      // A package's vitest config and its Obsidian integration setup reach the repository's own build scripts, which
      // no package depends on and none ships.
      files: [
        join(WORKSPACE_PACKAGES_FOLDER, RepoPaths.Any, 'vitest.config.ts'),
        join(WORKSPACE_PACKAGES_FOLDER, RepoPaths.Any, RepoPaths.Src, RepoPaths.AnyPath, RepoPaths.AnyTestTs)
      ],
      rules: {
        'import-x/no-relative-packages': 'off'
      }
    }
  ]);
}

export const configs: Linter.Config[] = defineEslintConfigs({
  customConfigs(context) {
    return defineConfig([
      ...getIgnoreConfigs(),
      ...getAstroConfigs(),
      ...getAstroConfigTypeCheckingConfigs(),
      ...getTsdocsConfigs(context),
      ...getJsdocsConfigs(context),
      ...getNoRestrictedSyntaxOverrideConfigs(),
      ...getWorkspaceBoundaryConfigs(context),
      ...getWorkspaceImportResolutionConfigs(),
      ...getDependConfigs(),
      ...getObsidianLintConfigs()
    ]);
  },

  editContext(context) {
    context.rootConfigFiles.push(
      WorkspaceRepoPaths.AstroConfigTs,
      join(WORKSPACE_PACKAGES_FOLDER, RepoPaths.Any, 'vitest.config.ts')
    );
    context.sourceFolders.push(join(WORKSPACE_PACKAGES_FOLDER, RepoPaths.Any, RepoPaths.Src));
    context.sourceFiles.push(
      join(WORKSPACE_PACKAGES_FOLDER, RepoPaths.Any, RepoPaths.Src, RepoPaths.AnyPath, RepoPaths.AnyTs),
      join(WorkspaceRepoPaths.Docs, RepoPaths.AnyPath, RepoPaths.AnyTs)
    );
    context.testFiles.push(
      join(WORKSPACE_PACKAGES_FOLDER, RepoPaths.Any, RepoPaths.Src, RepoPaths.AnyPath, RepoPaths.AnyTestTs),
      join(WORKSPACE_PACKAGES_FOLDER, RepoPaths.Any, RepoPaths.Src, RepoPaths.TestHelpers, RepoPaths.AnyPath, RepoPaths.AnyTs),
      /*
       * A docs-site test is a TEST, and this convention puts it beside the module it covers, under `docs/` rather
       * than under `src/`. The `sourceFiles` push above claims every TypeScript file under `docs/`, and the shared
       * config's own test glob is rooted at `src/`, so without this line the one docs-site test -- collected by the
       * `unit-tests:docs-generator` vitest project -- was linted as a source file, with `no-magic-numbers` and
       * `unicorn/consistent-function-scoping` at `error`.
       *
       * As there, the file now matches BOTH lists and that is deliberate. The two source-scoped families that turn
       * rules ON and would otherwise reach it -- jsdoc/tsdoc and `n/no-unsupported-features` -- each already carry
       * `ignores: context.testFiles`, so the promotion takes them off this file.
       */
      join(WorkspaceRepoPaths.Docs, RepoPaths.AnyPath, RepoPaths.AnyTestTs)
    );
    context.scriptFiles.push(
      WorkspaceRepoPaths.AstroConfigTs,
      // The tooling packages run in Node, never in the Obsidian runtime, exactly like a project's own scripts.
      ...TOOLING_PACKAGE_FOLDERS.map((packageFolder) => join(WORKSPACE_PACKAGES_FOLDER, packageFolder, RepoPaths.Src, RepoPaths.AnyPath, RepoPaths.AnyTs)),
      // The two test-support modules that patch the Node process itself.
      join(WORKSPACE_PACKAGES_FOLDER, 'typescript-test-toolkit', RepoPaths.Src, 'node-web-globals.ts'),
      join(WORKSPACE_PACKAGES_FOLDER, 'typescript-test-toolkit', RepoPaths.Src, 'warnings-as-errors.ts')
    );
  }
});
