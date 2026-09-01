/**
 * @file
 *
 * ESLint configuration for TypeScript projects with various plugins.
 *
 * This module exports ESLint configurations for TypeScript projects, integrating multiple ESLint plugins
 * such as `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`,
 * `eslint-plugin-modules-newlines`, `@stylistic/eslint-plugin`.
 * It sets up parsers, plugins, and rules for maintaining code quality and consistency.
 */

/* v8 ignore start -- Declarative ESLint rule/plugin configuration; correctness is verified by running ESLint, not unit tests. */

import type { Linter } from 'eslint';

/* eslint-disable no-magic-numbers -- We disabled magic numbers because they are used all over the configs. */
import commentsConfigs from '@eslint-community/eslint-plugin-eslint-comments/configs';
import { includeIgnoreFile } from '@eslint/config-helpers';
import eslint from '@eslint/js';
// eslint-disable-next-line import-x/no-rename-default -- The default export name `plugin` is too confusing.
import stylistic from '@stylistic/eslint-plugin';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { flatConfigs as eslintPluginImportXFlatConfigs } from 'eslint-plugin-import-x';
// eslint-disable-next-line import-x/no-rename-default -- The default export name `_default` is too confusing.
import nodePlugin from 'eslint-plugin-n';
// eslint-disable-next-line import-x/no-rename-default -- The default export name `plugin` is too confusing.
import obsidianmd from 'eslint-plugin-obsidianmd';
import { PlainTextParser } from 'eslint-plugin-obsidianmd/dist/lib/plainTextParser.js';
import { configs as perfectionistConfigs } from 'eslint-plugin-perfectionist';
// eslint-disable-next-line import-x/no-rename-default -- The default export name `index` is too confusing.
import unicorn from 'eslint-plugin-unicorn';
import { defineConfig } from 'eslint/config';
import { existsSync } from 'node:fs';
// eslint-disable-next-line import-x/no-rename-default -- The default export name `_default` is too confusing.
import tseslint from 'typescript-eslint';

import { ObsidianPluginRepoPaths } from '../../obsidian/plugin/obsidian-plugin-repo-paths.ts';
import { join } from '../../path.ts';
import { getRootFolder } from '../root.ts';
import { noRestrictedSyntaxRuleEntries } from './eslint-no-restricted-syntax.ts';
import { jsonPlugin } from './eslint-rules/manifest-helpers.ts';
import { obsidianDevUtilsPlugin } from './eslint-rules/obsidian-dev-utils-plugin.ts';

/**
 * The parameters for defining ESLint configurations.
 */
export interface DefineEslintConfigsOptions {
  /**
   * A function that builds custom ESLint configurations.
   *
   * @param context - The ESLint configuration context.
   * @returns The custom ESLint configurations.
   */
  customConfigs?(context: EslintConfigContext): Linter.Config[];

  /**
   * A function that edits the ESLint configuration context.
   *
   * @param context - The ESLint configuration context.
   */
  editContext?(context: EslintConfigContext): void;
}

/**
 * The context for defining ESLint configurations.
 */
export class EslintConfigContext {
  /**
   * The root configuration files.
   */
  public readonly rootConfigFiles: string[] = [];

  /**
   * The script files.
   */
  public readonly scriptFiles: string[] = [];

  /**
   * The source files.
   */
  public readonly sourceFiles: string[] = [];

  /**
   * The test files.
   */
  public readonly testFiles: string[] = [];

  /**
   * The all files.
   *
   * @returns The all files.
   */
  public allFiles(): string[] {
    return [...this.testFiles, ...this.scriptFiles, ...this.rootConfigFiles, ...this.sourceFiles];
  }
}

/**
 * Build ESLint configurations.
 *
 * This function builds ESLint configurations for TypeScript projects, integrating multiple ESLint plugins
 *
 * @param options - The parameters for defining ESLint configurations.
 * @returns The ESLint configurations.
 */
export function defineEslintConfigs(options: DefineEslintConfigsOptions = {}): Linter.Config[] {
  const context = new EslintConfigContext();
  context.rootConfigFiles.push(
    ObsidianPluginRepoPaths.CommitlintConfigTs,
    ObsidianPluginRepoPaths.EslintConfigMts,
    ObsidianPluginRepoPaths.VitestConfigTs
  );
  context.scriptFiles.push(
    join(ObsidianPluginRepoPaths.Scripts, ObsidianPluginRepoPaths.AnyPath, ObsidianPluginRepoPaths.AnyTs)
  );
  context.sourceFiles.push(
    join(ObsidianPluginRepoPaths.Src, ObsidianPluginRepoPaths.AnyPath, ObsidianPluginRepoPaths.AnyTs),
    join(ObsidianPluginRepoPaths.Src, ObsidianPluginRepoPaths.AnyPath, ObsidianPluginRepoPaths.AnyTsx)
  );
  context.testFiles.push(
    join(ObsidianPluginRepoPaths.Tests, ObsidianPluginRepoPaths.AnyPath, ObsidianPluginRepoPaths.AnyTs),
    join(ObsidianPluginRepoPaths.Mocks, ObsidianPluginRepoPaths.AnyPath, ObsidianPluginRepoPaths.AnyTs),
    join(ObsidianPluginRepoPaths.Src, ObsidianPluginRepoPaths.AnyPath, ObsidianPluginRepoPaths.AnyTestTs)
  );

  if (options.editContext) {
    options.editContext(context);
  }

  const customConfigs = options.customConfigs?.(context) ?? [];

  return defineConfig(
    ...getGitIgnoreConfigs(),
    // Obsidianmd configs run first so our stricter rules override their relaxed defaults
    ...getObsidianLintConfigs(context),
    ...getEslintConfigs(context),
    ...getTseslintConfigs(context),
    ...getStylisticConfigs(context),
    ...getImportXConfigs(context),
    ...getPerfectionistConfigs(context),
    ...getUnicornConfigs(context),
    ...getEslintImportResolverTypescriptConfigs(),
    ...getEslintCommentsConfigs(context),
    ...getObsidianDevUtilsPluginConfigs(context),
    ...getNodeCompatConfigs(context),
    ...getIntegrationTestConfigs(),
    ...getManifestConfigs(),
    ...getLicenseConfigs(),
    ...customConfigs
  );
}

function getEslintCommentsConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig([
    {
      // eslint-disable-next-line import-x/no-named-as-default-member -- The default export name `recommended` is too confusing.
      extends: [commentsConfigs.recommended],
      files: context.allFiles(),
      rules: {
        '@eslint-community/eslint-comments/require-description': 'error'
      }
    }
  ]);
}

function getEslintConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig([
    {
      extends: [eslint.configs.recommended],
      files: context.allFiles(),
      rules: {
        'accessor-pairs': 'error',
        'array-callback-return': 'error',
        'camelcase': 'error',
        'capitalized-comments': ['error', 'always', { block: { ignorePattern: 'v8' } }],
        'complexity': 'error',
        'consistent-this': 'error',
        'curly': 'error',
        'default-case': 'error',
        'default-case-last': 'error',
        'default-param-last': 'error',
        'eqeqeq': 'error',
        'func-name-matching': 'error',
        'func-names': 'error',
        'func-style': [
          'error',
          'declaration',
          {
            allowArrowFunctions: false
          }
        ],
        'grouped-accessor-pairs': [
          'error',
          'getBeforeSet'
        ],
        'guard-for-in': 'error',
        'no-alert': 'error',
        'no-array-constructor': 'error',
        'no-bitwise': 'error',
        'no-caller': 'error',
        'no-console': [
          'error',
          {
            allow: [
              'warn',
              'error'
            ]
          }
        ],
        'no-constructor-return': 'error',
        'no-div-regex': 'error',
        'no-else-return': [
          'error',
          {
            allowElseIf: false
          }
        ],
        'no-empty-function': 'error',
        'no-extend-native': 'error',
        'no-extra-bind': 'error',
        'no-extra-label': 'error',
        'no-implicit-coercion': [
          'error',
          {
            allow: [
              '!!'
            ]
          }
        ],
        'no-implied-eval': 'error',
        'no-inner-declarations': 'error',
        'no-iterator': 'error',
        'no-label-var': 'error',
        'no-labels': 'error',
        'no-lone-blocks': 'error',
        'no-lonely-if': 'error',
        'no-loop-func': 'error',
        'no-magic-numbers': [
          'error',
          {
            detectObjects: true,
            enforceConst: true,
            ignore: [
              -1,
              0,
              1
            ]
          }
        ],
        'no-multi-assign': 'error',
        'no-multi-str': 'error',
        'no-negated-condition': 'error',
        'no-nested-ternary': 'error',
        'no-new-func': 'error',
        'no-new-wrappers': 'error',
        'no-object-constructor': 'error',
        'no-octal-escape': 'error',
        'no-promise-executor-return': 'error',
        'no-proto': 'error',
        'no-restricted-syntax': [
          'error',
          ...noRestrictedSyntaxRuleEntries
        ],
        'no-return-assign': 'error',
        'no-script-url': 'error',
        'no-self-compare': 'error',
        'no-sequences': 'error',
        'no-shadow': 'error',
        'no-template-curly-in-string': 'error',
        'no-throw-literal': 'error',
        'no-unmodified-loop-condition': 'error',
        'no-unneeded-ternary': 'error',
        'no-unreachable-loop': 'error',
        'no-unused-expressions': 'error',
        'no-useless-assignment': 'error',
        'no-useless-call': 'error',
        'no-useless-computed-key': 'error',
        'no-useless-concat': 'error',
        'no-useless-constructor': 'error',
        'no-useless-rename': 'error',
        'no-useless-return': 'error',
        'no-var': 'error',
        'no-void': 'error',
        'object-shorthand': 'error',
        'operator-assignment': 'error',
        'prefer-arrow-callback': 'error',
        'prefer-const': 'error',
        'prefer-exponentiation-operator': 'error',
        'prefer-named-capture-group': 'error',
        'prefer-numeric-literals': 'error',
        'prefer-object-has-own': 'error',
        'prefer-object-spread': 'error',
        'prefer-promise-reject-errors': 'error',
        'prefer-regex-literals': 'error',
        'prefer-rest-params': 'error',
        'prefer-spread': 'error',
        'prefer-template': 'error',
        'radix': 'error',
        'require-atomic-updates': 'error',
        'require-await': 'error',
        'symbol-description': 'error',
        'unicode-bom': 'error',
        'vars-on-top': 'error',
        'yoda': 'error'
      }
    },
    {
      files: context.testFiles,
      rules: {
        'no-magic-numbers': 'off'
      }
    }
  ]);
}

function getEslintImportResolverTypescriptConfigs(): Linter.Config[] {
  return defineConfig([
    {
      settings: {
        'import-x/resolver-next': [
          createTypeScriptImportResolver({
            alwaysTryTypes: true
          })
        ]
      }
    }
  ]);
}

function getGitIgnoreConfigs(): Linter.Config[] {
  const gitignorePath = join(getRootFolder() ?? '', '.gitignore');
  if (!existsSync(gitignorePath)) {
    return [];
  }
  return [includeIgnoreFile(gitignorePath)];
}

function getImportXConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig([
    {
      extends: [
        eslintPluginImportXFlatConfigs.recommended,
        eslintPluginImportXFlatConfigs.typescript,
        eslintPluginImportXFlatConfigs.errors,
        eslintPluginImportXFlatConfigs.warnings
      ],
      files: context.allFiles(),
      rules: {
        'import-x/consistent-type-specifier-style': 'error',
        'import-x/extensions': ['error', 'ignorePackages'],
        'import-x/first': 'error',
        'import-x/imports-first': 'error',
        'import-x/newline-after-import': 'error',
        'import-x/no-absolute-path': 'error',
        'import-x/no-amd': 'error',
        'import-x/no-anonymous-default-export': 'error',
        'import-x/no-commonjs': 'error',
        'import-x/no-cycle': 'error',
        'import-x/no-default-export': 'error',
        'import-x/no-deprecated': 'error',
        'import-x/no-duplicates': 'error',
        'import-x/no-dynamic-require': 'error',
        'import-x/no-empty-named-blocks': 'error',
        'import-x/no-extraneous-dependencies': 'error',
        'import-x/no-import-module-exports': 'error',
        'import-x/no-mutable-exports': 'error',
        'import-x/no-named-default': 'error',
        'import-x/no-namespace': 'error',
        'import-x/no-nodejs-modules': 'error',
        'import-x/no-relative-packages': 'error',
        'import-x/no-restricted-paths': 'error',
        'import-x/no-self-import': 'error',
        'import-x/no-unassigned-import': [
          'error',
          {
            allow: [
              '**/*.css',
              '**/*.sass',
              '**/*.scss'
            ]
          }
        ],
        'import-x/no-unused-modules': 'off',
        'import-x/no-useless-path-segments': 'error',
        'import-x/no-webpack-loader-syntax': 'error'
      }
    },
    {
      files: context.scriptFiles,
      rules: {
        'import-x/no-nodejs-modules': 'off'
      }
    },
    {
      files: [
        ...context.rootConfigFiles,
        join(ObsidianPluginRepoPaths.Src, ObsidianPluginRepoPaths.MainTs)
      ],
      rules: {
        'import-x/no-default-export': 'off'
      }
    }
  ]);
}

function getIntegrationTestConfigs(): Linter.Config[] {
  return defineConfig([
    {
      // Integration tests run in a Node environment and legitimately read files / paths, so the Node-builtins bans do not apply to them.
      files: [join(ObsidianPluginRepoPaths.Src, ObsidianPluginRepoPaths.AnyPath, ObsidianPluginRepoPaths.AnyIntegrationTestTs)],
      rules: {
        'import-x/no-nodejs-modules': 'off',
        'obsidianmd/no-nodejs-modules': 'off'
      }
    },
    {
      /*
       * An integration test that drives the UI with `dispatchEvent(new KeyboardEvent(...))` produces an
       * UNTRUSTED event, and Obsidian and CodeMirror gate on `isTrusted` — so the test can exercise
       * nothing while still passing. Only integration tests are covered: a unit test has no real input
       * pipeline to reach, so dispatching is the only thing it can do.
       *
       * Android is exempt BY FILENAME rather than by a disable comment, because the exemption is a
       * property of the platform rather than of any one call site: the trusted helpers are built on
       * `window.electron`, which does not exist there, so every dispatch in such a file is legitimate and
       * always will be. A `*.cross-platform.*` file is deliberately NOT exempt — it runs on desktop too,
       * where the trusted path is available, so it should branch on `Platform.isDesktopApp` and disable
       * the rule on the mobile arm alone.
       */
      files: [join(ObsidianPluginRepoPaths.Src, ObsidianPluginRepoPaths.AnyPath, ObsidianPluginRepoPaths.AnyIntegrationTestTs)],
      ignores: [
        join(ObsidianPluginRepoPaths.Src, ObsidianPluginRepoPaths.AnyPath, ObsidianPluginRepoPaths.AnyAndroidIntegrationTestTs),
        join(ObsidianPluginRepoPaths.Src, ObsidianPluginRepoPaths.AnyPath, ObsidianPluginRepoPaths.AnyAndroidCaptureIntegrationTestTs)
      ],
      rules: {
        'obsidian-dev-utils/no-untrusted-input-events': 'error'
      }
    }
  ]);
}

/*
 * The Community directory requires a root `LICENSE`, and `obsidianmd/validate-license` is the only check
 * on what it says: the copyright holder must not still be the sample plugin's, and the year must be
 * current. Both need `PlainTextParser`, which the plugin does not export, so it is reached through its
 * build output -- the package declares no `exports` map and ships a declaration beside the module, so the
 * deep path resolves, but it is the one import here that a patch release upstream could break.
 *
 * The rule compares the year against `new Date().getFullYear()` at lint time, so a repo goes red at the
 * turn of the year until its LICENSE is bumped. `.github/workflows/update-license-year.yml` does that on
 * 1 January; a repo adopting this config needs the same workflow, or the year check will fail its CI.
 */
function getLicenseConfigs(): Linter.Config[] {
  return defineConfig([
    {
      files: [ObsidianPluginRepoPaths.License],
      languageOptions: {
        parser: PlainTextParser
      },
      plugins: {
        obsidianmd
      },
      rules: {
        'obsidianmd/validate-license': 'error'
      }
    }
  ]);
}

/*
 * The root `manifest.json` is what the Community directory's automated review actually reads, and until
 * this config existed no linter read it at all: `obsidianmd/validate-manifest` registers a `Program`
 * visitor and expects an ESTree `ObjectExpression`, while every JSON parser that ships produces something
 * else -- `@eslint/json` produces Momoa (`Document`), `jsonc-eslint-parser` produces
 * `JSONObjectExpression` -- so the rule silently matches nothing no matter which files it is scoped to.
 * The in-house rules below visit the Momoa AST instead.
 *
 * `manifest.json` is strict JSON, so an `eslint-disable` comment in it is a parse error AND would stop
 * Obsidian loading the plugin. That makes the config the only place a check can be waived, which is why
 * these are four rules rather than one: a repo with a grandfathered `id` can turn off `manifest-id` alone
 * and keep the rest.
 */
function getManifestConfigs(): Linter.Config[] {
  return defineConfig([
    {
      files: [ObsidianPluginRepoPaths.ManifestJson],
      language: 'json/json',
      plugins: {
        'json': jsonPlugin,
        'obsidian-dev-utils': obsidianDevUtilsPlugin
      },
      rules: {
        'obsidian-dev-utils/manifest-description': 'error',
        'obsidian-dev-utils/manifest-id': 'error',
        'obsidian-dev-utils/manifest-name': 'error',
        'obsidian-dev-utils/manifest-schema': 'error'
      }
    }
  ]);
}

function getNodeCompatConfigs(context: EslintConfigContext): Linter.Config[] {
  /*
   * The minimum Obsidian installer that still receives app updates and works is 1.1.9, which ships Electron
   * 21.3.3 and runs Node 16.16.0. Shipped source must therefore avoid Node/ES runtime builtins unavailable in
   * that version. Tests and scripts are dev-only and exempt.
   *
   * Source of truth: `obsidian-integration-testing/metadata.json` — the newest release carrying the field
   * (1.13.1) declares `minRunnableInstallerVersion: "1.1.9"`, and that installer's `runtimeVersions` gives the
   * Electron and Node versions above. Re-derive from there rather than editing this number by hand.
   */
  const minimumNodeVersion = '>=16.16.0';

  return defineConfig([
    {
      files: context.sourceFiles,
      ignores: [
        ...context.testFiles,
        // Dev-only tooling (build, lint, version) under `src/script-utils/**` runs via `jiti` in the consumer's Node environment when building a plugin and never ships into the Obsidian runtime, so the Node-16 floor does not apply to it.
        join(ObsidianPluginRepoPaths.ScriptUtils, ObsidianPluginRepoPaths.AnyPath, ObsidianPluginRepoPaths.AnyTs)
      ],
      plugins: {
        n: nodePlugin
      },
      rules: {
        'n/no-unsupported-features/es-builtins': [
          'error',
          {
            version: minimumNodeVersion
          }
        ],
        'n/no-unsupported-features/node-builtins': [
          'error',
          {
            // `Blob` and `File` are DOM web globals always present in the Obsidian/Electron renderer (every supported Chromium), but the rule also knows them as Node's experimental builtins and cannot tell which is meant. Ignore them globally; genuinely newer APIs (e.g. `AbortSignal.any`) stay flagged.
            ignores: [
              'Blob',
              'File'
            ],
            version: minimumNodeVersion
          }
        ]
      }
    }
  ]);
}

function getObsidianDevUtilsPluginConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig([
    {
      files: context.allFiles(),
      plugins: {
        'obsidian-dev-utils': obsidianDevUtilsPlugin
      },
      rules: {
        'obsidian-dev-utils/no-async-callback-to-unsafe-return': 'error',
        'obsidian-dev-utils/no-unused-params-members': 'error',
        'obsidian-dev-utils/no-used-underscore-variables': 'error',
        'obsidian-dev-utils/params-options-name-match': 'error',
        'obsidian-dev-utils/prefer-noop-async': 'error',
        'obsidian-dev-utils/readonly-params-options-result-members': 'error',
        'obsidian-dev-utils/require-component-suffix': 'error',
        'obsidian-dev-utils/require-method-template': 'error',
        'obsidian-dev-utils/require-super-call': 'off'
      }
    }
  ]);
}

function getObsidianLintConfigs(context: EslintConfigContext): Linter.Config[] {
  const obsidianRecommendedConfigs = obsidianmd.configs.recommended;

  const scopedObsidianRecommendedConfigs = obsidianRecommendedConfigs.map((config) => {
    if (config.files?.includes('package.json')) {
      return config;
    }

    return {
      ...config,
      files: context.sourceFiles
    };
  });

  return defineConfig([
    {
      extends: [scopedObsidianRecommendedConfigs],
      plugins: {
        obsidianmd
      }
    }
  ]);
}

function getPerfectionistConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig([{
    extends: [perfectionistConfigs['recommended-alphabetical']],
    files: context.allFiles()
  }]);
}

function getStylisticConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig([
    {
      extends: [
        stylistic.configs.recommended,
        stylistic.configs.customize({
          arrowParens: true,
          braceStyle: '1tbs',
          commaDangle: 'never',
          semi: true
        })
      ],
      files: context.allFiles(),
      rules: {
        '@stylistic/generator-star-spacing': 'off',
        '@stylistic/indent': 'off',
        '@stylistic/indent-binary-ops': 'off',
        '@stylistic/jsx-one-expression-per-line': 'off',
        '@stylistic/no-extra-semi': 'error',
        '@stylistic/object-curly-newline': [
          'error',
          {
            ExportDeclaration: {
              minProperties: 2,
              multiline: true
            },
            ImportDeclaration: {
              minProperties: 2,
              multiline: true
            }
          }
        ],
        '@stylistic/operator-linebreak': [
          'error',
          'before',
          {
            overrides: {
              '=': 'after'
            }
          }
        ],
        '@stylistic/quotes': [
          'error',
          'single',
          {
            allowTemplateLiterals: 'never'
          }
        ]
      }
    }
  ]);
}

function getTseslintConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig([
    {
      extends: [
        // eslint-disable-next-line import-x/no-named-as-default-member -- The default export name `_default` is too confusing.
        ...tseslint.configs.strictTypeChecked,
        // eslint-disable-next-line import-x/no-named-as-default-member -- The default export name `_default` is too confusing.
        ...tseslint.configs.stylisticTypeChecked
      ],
      files: context.allFiles(),
      languageOptions: {
        parserOptions: {
          ecmaFeatures: {
            jsx: true
          },
          projectService: true,
          // eslint-disable-next-line unicorn/name-replacements -- `tsconfigRootDir` is a `typescript-eslint` parser option.
          tsconfigRootDir: getRootFolder() ?? ''
        }
      },
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'error',
        '@typescript-eslint/explicit-member-accessibility': 'error',
        '@typescript-eslint/method-signature-style': ['error', 'method'],
        '@typescript-eslint/no-floating-promises': ['error', {
          checkThenables: true
        }],
        '@typescript-eslint/no-invalid-void-type': ['error', {
          allowAsThisParameter: true
        }],
        '@typescript-eslint/no-this-alias': ['error', {
          allowedNames: [
            'that'
          ]
        }],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            // eslint-disable-next-line unicorn/name-replacements -- `args` is an ESLint rule option name.
            args: 'all',
            // eslint-disable-next-line unicorn/name-replacements -- `argsIgnorePattern` is a `typescript-eslint` rule option name.
            argsIgnorePattern: '^_',
            caughtErrors: 'all',
            caughtErrorsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
            ignoreRestSiblings: true,
            // eslint-disable-next-line unicorn/name-replacements -- `varsIgnorePattern` is a `typescript-eslint` rule option name.
            varsIgnorePattern: '^_'
          }
        ],
        '@typescript-eslint/prefer-readonly': 'error'
      }
    },
    {
      files: context.testFiles,
      rules: {
        '@typescript-eslint/dot-notation': ['error', {
          allowPrivateClassPropertyAccess: true,
          allowProtectedClassPropertyAccess: true
        }],
        '@typescript-eslint/unbound-method': 'off'
      }
    },
    {
      settings: {
        react: {
          version: 'detect'
        }
      }
    }
  ]);
}

function getUnicornConfigs(context: EslintConfigContext): Linter.Config[] {
  return defineConfig([
    {
      extends: [unicorn.configs.recommended],
      files: context.allFiles(),
      rules: {
        /*
         * These entries are not abbreviations to be expanded — they are established vocabulary here.
         *
         * Brand: `dev`, `lib`, `util`/`utils` spell the product's own name. Left on, the rule rewrites
         * `ObsidianDevUtilsRepoPaths` to `ObsidianDevelopmentUtilitiesRepoPaths` and `getLibDebugger` to
         * `getLibraryDebugger`, renaming exported API after the package it belongs to.
         *
         * Convention: `params` is the parameter-bag convention, enforced by
         * `obsidian-dev-utils/params-options-name-match`, which requires bag types to be named
         * `<Owner>Params` / `<Owner>Options`. Expanding it to `Parameters` would put the two rules in direct
         * contradiction and break 300+ exported type names.
         *
         * Reserved words: a bare `args`, `fn`, `str`, `mod` or `evt` expands to an identifier that is already
         * taken, so the rule suggests `$arguments`, `$function`, and so on. Spell those `$arguments` /
         * `$function` instead — a `$` prefix reads better than a trailing underscore. This is deliberately NOT
         * configured as a custom replacement: unicorn substitutes at the word level inside compound names, so
         * redirecting the whole entry turns `asyncFn` into `async$function`. Compounds want the plain expansion
         * (`asyncFunction`); only the bare, genuinely-colliding identifiers take the `$` form.
         *
         * Domain words: `doc`/`docs`, `env`, `dist` and `src` are the clearer spelling in this codebase.
         * Expanding `doc` also picks the wrong word — the `api-doc-*` modules generate API *documentation*, not
         * documents. `src` additionally corrupts code: the fixer renames the `Src` member of the exported
         * `ObsidianPluginRepoPaths` / `ObsidianDevUtilsRepoPaths` enums while leaving every `.Src` reference
         * dangling, because `checkProperties` exempts property accesses but not the declarations they point at.
         *
         * Disabling the replacement entries protects these permanently; an `allowList` would instead need every
         * affected identifier enumerated by hand and re-enumerated for every new one.
         *
         * NOTE: this rule's autofix is NOT reference-aware for declarations that participate in a contract —
         * enum members, interface members, and TypeScript parameter properties (`constructor(private readonly
         * el: HTMLElement)`) are renamed while `this.el` and `Enum.Member` references are left dangling. Apply
         * its reports by hand; never run `--fix` over it.
         */
        /*
         * A good rule, but its default prefixes force ungrammatical names: `memberPageExists` would become
         * `isMemberPageExists` rather than `doesMemberPageExist`. These entries EXTEND the defaults (`is`,
         * `has`, `can`, `should`, ...) rather than replacing them, so a boolean with no boolean-reading prefix
         * at all is still rejected -- the rule just stops insisting the prefix come from a shorter list.
         *
         * The list is bidirectional: adding a prefix also asserts that everything named with it IS a boolean.
         * `check` earns its place on both counts, since the handful of non-boolean `check*` names it surfaced
         * were genuinely mis-named (void functions that throw, a probe returning an HTTP status). `test` was
         * measured and rejected: it would validate five `test*` link predicates that read better as `is*`
         * anyway, at the cost of renaming SCREAMING_CASE test fixtures and the `testCoverage`/`testWatch`
         * runners that deliberately mirror the `test:coverage`/`test:watch` npm scripts.
         */
        'unicorn/consistent-boolean-name': [
          'error',
          {
            prefixes: {
              allows: true,
              check: true,
              contains: true,
              does: true,
              includes: true,
              must: true,
              needs: true,
              supports: true
            }
          }
        ],
        /*
         * Unsatisfiable alongside `perfectionist/sort-classes`, which is configured here as a plain
         * alphabetical sort. This rule wants a category order (all fields, then the constructor, then all
         * methods), so the extremely common `private _x` field paired with a `public get x()` accessor is
         * rejected by whichever rule loses: alphabetically the accessor precedes the field, by category the
         * field precedes the accessor. Unlike `prefer-global-this` the clash produces no
         * `ESLintCircularFixesWarning`, only because this rule ships no fixer -- both rules are `error`, so no
         * arrangement of members satisfies them both. The alphabetical sort is the one already rolled out
         * across the plugins consuming this config, so it keeps precedence. Re-enabling this rule would mean
         * giving `perfectionist/sort-classes` a matching `groups` option and reordering every class.
         */
        'unicorn/consistent-class-member-order': 'off',
        /*
         * Every report is `new Error().stack`, which captures a stack trace and never surfaces its message,
         * or `new AggregateError(errors)`, whose message is optional precisely because the collected errors
         * carry the detail. The rule cannot tell either from an error that is actually thrown at a user.
         */
        'unicorn/error-message': 'off',
        /*
         * The default style for `node:path` is a default import, but this codebase imports its members by name
         * throughout, consistently with every other `node:` module it uses. Configure the rule to enforce the
         * style actually in use rather than annotate 17 sites that are not going to change.
         */
        'unicorn/import-style': [
          'error',
          {
            styles: {
              // Keyed by the UNPREFIXED module name: the rule's own table uses `path`, so a `node:path` key never matches.
              path: {
                named: true
              }
            }
          }
        ],
        /*
         * The rule counts constructor calls and counts through array and object literals, so its default of 3
         * reports ordinary composition: `Promise.reject(new Error('boom'))` inside an assertion, a test fixture
         * built as `createTypeInfo({ methods: [createMemberInfo({ ... })] })`, `this.addChild(new C(this.app))`
         * inside a params bag. Raising the limit by one clears every report here while still catching the
         * genuinely unreadable nesting the rule is for.
         */
        'unicorn/max-nested-calls': [
          'error',
          {
            max: 4
          }
        ],
        'unicorn/name-replacements': [
          'error',
          {
            /*
             * Property and member names are checked too, so an abbreviation cannot survive by living on an
             * object rather than in a variable.
             *
             * The rule is purely syntactic: it cannot tell a member we declare from one belonging to a
             * dependency, and it offers no autofix for properties (measured: 681 hits, 0 with a fixer). Sites
             * naming a foreign member -- `DomElementInfo.attr`, `EvalInObsidianParams.fn`, and the like -- are
             * therefore impossible to satisfy and carry an inline disable, so everything still reported is ours
             * to rename.
             *
             * When renaming the rest, note that `tsc` alone is NOT a sufficient gate: object-literal keys in
             * loosely typed positions (`expect.arrayContaining([{ batchedArguments: ... }])`) are not contextually
             * typed, so a rename leaves them behind and breaks the suite where the type checker sees nothing.
             * Rename in small batches with the full test run in the loop.
             *
             * The disabled replacements below are established vocabulary rather than abbreviations to be
             * expanded. `el` is exempt because Obsidian names every element member that way -- `containerEl`,
             * `contentEl`, `inputEl`, `selectEl` -- so expanding ours to `*Element` would leave our components
             * reading inconsistently beside the Obsidian ones they sit next to. Disabling the replacement also
             * covers compound names, which is 72 sites that would otherwise each need an inline disable.
             *
             * `ref` is exempt for the same reason: `AsyncEventRef` is the async counterpart of Obsidian's
             * `EventRef`, handed to the same `offref` / `registerEvent` shapes, so the two names have to match
             * to read as a pair.
             */
            checkProperties: true,
            replacements: {
              /*
               * `attr` / `attrs` are Obsidian's own: `createEl('a', { attr: { ... } })` takes them by those
               * names on `DomElementInfo`, so ours have to match to be passed through. `props` is the
               * universal component vocabulary, exempt for the same reason `params` is.
               */
              attr: false,
              attrs: false,
              dev: false,
              /*
               * Every `dir` here is a filesystem directory, never a direction, so the rule is narrowed to the
               * one expansion rather than left offering a choice it cannot make.
               */
              // eslint-disable-next-line unicorn/name-replacements -- This is the rule's own replacement key, which has to be spelled the way the rule reads it.
              dir: {
                direction: false,
                directory: true
              },
              dist: false,
              doc: false,
              docs: false,
              el: false,
              env: false,
              lib: false,
              params: false,
              props: false,
              ref: false,
              refs: false,
              src: false,
              util: false,
              utils: false
            }
          }
        ],
        /*
         * The next six rules all suggest an API newer than this project's `lib` (`ES2022`), so following any of
         * them fails to compile. The target is not arbitrary: `obsidian-integration-testing/metadata.json`
         * records `ecmaScriptVersion: "ES2022"` for installer 1.1.9, the oldest one still able to run current
         * Obsidian. Each is off at the config level rather than annotated per site, because none can ever be
         * satisfied while that floor holds. Revisit them together if the floor moves.
         *
         * `Array#toReversed` and `Array#toSorted` are ES2023.
         */
        'unicorn/no-array-reverse': 'off',
        'unicorn/no-array-sort': 'off',
        /*
         * `continue` inside a nested loop is ordinary, readable control flow here. The rule's remedy is to
         * extract every such loop into its own function, which spreads one coherent traversal across two
         * declarations without making anything clearer.
         */
        'unicorn/no-break-in-nested-loop': 'off',
        /*
         * The rule cannot see through a hoisted function declaration, so it treats a binding that a nested
         * function already read as unused before the exit. In `runWithTimeout` that is `let isCompleted`, which
         * `run()` and `innerTimeout()` both touch while the `Promise.race` above the exit is still running --
         * moving the declaration past the exit, as the rule asks, would leave those reads in the temporal dead
         * zone. Its own fixer declines all 15 sites for the same reason it cannot prove them safe, so following
         * the rule is entirely manual. What is left after that is placement style: the remaining reports are
         * named constants and derived paths deliberately grouped at the top of a function, and pushing each one
         * below the first guard splits a cohesive block to no benefit. The three sites where deferring skipped
         * real work (a second `computeNeededExposure` walk, a `toJson` serialization, an `ensureLfEndings` pass)
         * were applied by hand instead.
         */
        'unicorn/no-declarations-before-early-exit': 'off',
        /*
         * Assigning onto the global object is how this library installs and restores test doubles, and how a
         * few Obsidian-runtime globals are reached at all. The rule cannot separate that from an accidental
         * global write, and it has no fixer.
         */
        'unicorn/no-global-object-property-assignment': 'off',
        // `null` is load-bearing here: an optional collaborator is modelled as a required `null | X` field rather than an optional `X`, so `null` and `undefined` are not interchangeable.
        /*
         * The rule's list of standard `Symbol` properties predates explicit resource management, so it reports
         * `Symbol.dispose` and `Symbol.asyncDispose` as non-standard. Both are part of the language that this
         * library is built on -- 114 files here use `using` declarations, and the disposable types are a
         * public part of its surface -- so all 59 reports are the rule being out of date rather than a finding.
         */
        'unicorn/no-nonstandard-builtin-properties': 'off',
        'unicorn/no-null': 'off',
        /*
         * TypeScript's explicit `this` parameter (`function get(this: Holder) { return this.value; }`) makes
         * `this` outside a class both legal and type-checked, but the rule is syntactic and flags it identically
         * to a genuinely unbound `this`. It has no options (`schema: []`) and no fixer, so there is no way to
         * separate the idiom from the bug it targets. Most hits here were typed `this` parameters and tests that
         * deliberately assert `this` binding.
         */
        'unicorn/no-this-outside-of-class': 'off',
        // Same call as its object counterpart above: the destructuring depth flagged here is deliberate and reads well.
        'unicorn/no-unreadable-array-destructuring': 'off',
        /*
         * The reports are all `for (const file of await readdirPosix(...))`, which reads exactly as intended.
         * Hoisting the awaited call into a variable named after the loop's own iterable adds a line and a name
         * without adding information.
         */
        'unicorn/no-unreadable-for-of-expression': 'off',
        /*
         * The nested destructuring this flags is deliberate here and reads well: pulling a member out of a
         * params bag in one step states where the value comes from, which a second intermediate binding only
         * obscures. The rule takes no options, so there is no way to keep the depth limit it is really after
         * while allowing the shape in use.
         */
        'unicorn/no-unreadable-object-destructuring': 'off',
        /*
         * `checkArguments` strips `undefined` arguments, which shifts the remaining positional arguments into
         * the wrong slots; `checkArrowFunctionBody` removes `return undefined;` from arrow bodies whose other
         * branches do return a value, which violates the `noImplicitReturns` setting this project compiles with.
         * The rule's remaining cases (a bare `undefined` initializer, `return undefined;` in a void function)
         * are still worth having.
         */
        'unicorn/no-useless-undefined': [
          'error',
          {
            checkArguments: false,
            checkArrowFunctionBody: false
          }
        ],
        // `Array.fromAsync` is ES2024. See the ES2022 floor note above.
        'unicorn/prefer-array-from-async': 'off',
        /*
         * Every hit here is a promise deliberately NOT awaited, and `await` would change what the code does.
         * `result.catch(throwDelayed)` in `async-events.ts` is the fire-and-forget error path the module is
         * built on; the rest hold an unresolved promise and assert the callback has not fired yet, so awaiting
         * would hang the test or invert what it proves. The rule cannot tell a forgotten `await` from an
         * intentional one, and this codebase schedules fire-and-forget work as a core pattern.
         */
        'unicorn/prefer-await': 'off',
        /*
         * All three reports read HTML out (`const html = el.innerHTML`), never write it, and for a read
         * `getHTML()` returns the same string. What it adds is shadow-root serialization options that nothing
         * here asks for, in exchange for a much newer platform floor than `innerHTML` -- a bad trade for a
         * library that has to run on whatever Chromium the installed Obsidian ships. The rule's other half,
         * rewriting writes to the sanitizing `setHTML()`, would be worth having; it just never fires here.
         */
        'unicorn/prefer-dom-node-html-methods': 'off',
        /*
         * Obsidian's `Component` has its own `removeChild(component)` for the component lifecycle, unrelated
         * to `Node#removeChild`. The rule matches on the method name alone, so every report here is a
         * component being unloaded, and following the advice calls a `remove()` that does not exist -- which
         * is what `tsc` said when the fixer was let loose on them.
         */
        'unicorn/prefer-dom-node-remove': 'off',
        /*
         * Directly contradicts `obsidianmd/no-global-this`: this rule rewrites `window.x` to `globalThis.x`, and
         * that one forbids `globalThis` outright. With both enabled, `--fix` applies one and then the other
         * reverts it, which ESLint reports as `ESLintCircularFixesWarning` across 29 files. Obsidian's own
         * guidance wins in an Obsidian library, so this is the rule that gives way.
         */
        'unicorn/prefer-global-this': 'off',
        /*
         * Iterator helpers (`Iterator#some` and friends) are ES2025, so this belongs with `no-array-reverse` and
         * `no-array-sort` above: the same ES2022 floor rules it out, and the same note applies -- revisit them
         * together if that floor moves.
         */
        'unicorn/prefer-iterator-helpers': 'off',
        // `Iterator#toArray` is ES2025. See the ES2022 floor note above.
        'unicorn/prefer-iterator-to-array': 'off',
        /*
         * The suggested replacement is `Math.trunc(Number(x))`, which is longer than `parseInt(x, 10)` and no
         * clearer, and it is not the same function: `parseInt` stops at the first character that cannot be part
         * of the number, so `'12abc'` parses to 12 where `Number` yields `NaN`. Two of the reports read user
         * input through that difference -- the page-jump box in the Dataview helper, and
         * `NumberComponent.valueFromString`, whose lenient parse is part of a published component's behavior.
         * The rest parse machine-generated strings, where the two agree but the shorter spelling still wins.
         */
        'unicorn/prefer-number-coercion': 'off',
        // `Promise.withResolvers` is ES2024. See the ES2022 floor note above.
        'unicorn/prefer-promise-with-resolvers': 'off',
        // `Set#union` and friends are ES2025. See the ES2022 floor note above.
        'unicorn/prefer-set-methods': 'off',
        /*
         * The rule ranks operands by syntactic shape, not cost, so every report here swaps one property read
         * ahead of another and buys nothing. Its own message concedes it cannot check the part that matters --
         * "after verifying short-circuit behavior" -- and one report sits directly under a comment recording
         * that the operands change inside a `rename` event handler, which is where order stops being free.
         * The current orders also carry intent: a null guard before the use it guards, and the condition being
         * reported before the state it contradicts.
         */
        'unicorn/prefer-simple-condition-first': 'off',
        /*
         * `URL.canParse` requires Node 18.17, well above the Node 16.16.0 floor that shipped source targets
         * (see `minimumNodeVersion` below). The rule can therefore never be satisfied here, so it is off at the
         * config level rather than annotated at each call site.
         */
        'unicorn/prefer-url-can-parse': 'off',
        /*
         * Every array reported here holds strings, where the default sort is already well defined and correct.
         * Adding the comparator the rule asks for would mean choosing between code-unit and locale ordering,
         * so following it would CHANGE the sort rather than document it. The rule earns its place on numeric
         * arrays; it does not have any here.
         */
        'unicorn/require-array-sort-compare': 'off',
        // The codebase already spells encodings the way the Encoding Standard does (`utf-8`), which is also what `TextDecoder` reports. Keep the rule enforcing consistency, just in the direction already in use.
        'unicorn/text-encoding-identifier-case': [
          'error',
          {
            withDash: true
          }
        ]
      }
    },
    {
      // Build/lint/version scripts are CLI entry points, where exiting with a status code is the interface.
      files: context.scriptFiles,
      rules: {
        'unicorn/no-process-exit': 'off'
      }
    },
    {
      /*
       * A module-level fixture assigned from `beforeEach` is the standard test shape:
       *
       *   let app: App;
       *   beforeEach(() => { app = App.createConfigured__(); });
       *
       * The rule is right about production code -- module state reassigned from inside a function is worth
       * flagging, and the fix is to hold it in a `const` object instead. In tests that would replace every
       * `app` with `STATE.app` and make each file read worse for no gain, since the fixture is reset per test
       * by design. Scoped off here rather than disabled outright, so production code keeps the check.
       */
      files: context.testFiles,
      rules: {
        /*
         * Two shapes here cannot follow the advice. A helper defined inside an `evalInObsidian` callback
         * cannot be hoisted at all: the callback is serialized with `toString()` and runs inside Obsidian, so
         * anything left behind in the module scope is simply not there. And a per-suite factory
         * (`createComponent`, `createMockPlugin`) is deliberately local, keeping each suite's fixture next to
         * the assertions that read it. Production code keeps the check.
         */
        'unicorn/consistent-function-scoping': 'off',
        /*
         * A test binding is named after the thing it captures, not after what it does: `createElementSpy`
         * holds the spy on `createElement`, and `createProgramOptions` holds the options `createProgram` was
         * called with. The verb belongs to the name being referenced, so the rule reads it as a function name
         * that is not a function. Left on for production code, where the complaint is the right one.
         */
        'unicorn/no-non-function-verb-prefix': 'off',
        'unicorn/no-top-level-assignment-in-function': 'off'
      }
    }
  ]);
}

/* eslint-enable no-magic-numbers -- We disabled magic numbers because they are used all over the configs. */

/* v8 ignore stop */
