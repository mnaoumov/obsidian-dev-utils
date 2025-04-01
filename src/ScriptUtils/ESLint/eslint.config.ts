/**
 * @packageDocumentation eslint.config
 * ESLint configuration for TypeScript projects with various plugins.
 *
 * This module exports ESLint configurations for TypeScript projects, integrating multiple ESLint plugins
 * such as `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`,
 * `eslint-plugin-modules-newlines`, `@stylistic/eslint-plugin`.
 * It sets up parsers, plugins, and rules for maintaining code quality and consistency.
 *
 * @packageDocumentation eslint-config
 */

/* eslint-disable no-magic-numbers */

import type { Linter } from 'eslint';
import type { InfiniteDepthConfigWithExtends } from 'typescript-eslint';

import eslint from '@eslint/js';
// eslint-disable-next-line import-x/no-rename-default
import stylistic from '@stylistic/eslint-plugin';
import { flatConfigs as eslintPluginImportXFlatConfigs } from 'eslint-plugin-import-x';
import eslintPluginModulesNewlines from 'eslint-plugin-modules-newlines';
import perfectionist from 'eslint-plugin-perfectionist';
// eslint-disable-next-line import-x/no-rename-default
import tseslint from 'typescript-eslint';

import { join } from '../../Path.ts';
import { ObsidianDevUtilsRepoPaths } from '../ObsidianDevUtilsRepoPaths.ts';
import { getRootDir } from '../Root.ts';

/**
 * The ESLint configurations for TypeScript projects.
 */
export const configs: Linter.Config[] = tseslint.config(
  {
    files: [
      join(ObsidianDevUtilsRepoPaths.Src, ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyTs),
      join(ObsidianDevUtilsRepoPaths.Src, ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyTsx),
      join(ObsidianDevUtilsRepoPaths.Scripts, ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyTs)
    ]
  },
  {
    ignores: [
      join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyCjs),
      join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyJs),
      join(ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyMjs),
      join(ObsidianDevUtilsRepoPaths.Dist, ObsidianDevUtilsRepoPaths.AnyPath)
    ]
  },
  ...getEslintConfigs(),
  ...getTseslintConfigs(),
  ...getStylisticConfigs(),
  ...getImportXConfigs(),
  ...getPerfectionistConfigs(),
  ...getModulesNewlinesConfigs(),
  ...getModulesNewlinesConfigs(),
  ...getEslintImportResolverTypescriptConfigs()
) as Linter.Config[];

function excludeFilesProperty<Config extends { files?: unknown }>(config: Config): Config {
  const newConfig = { ...config };
  delete newConfig.files;
  return newConfig;
}

function getEslintConfigs(): InfiniteDepthConfigWithExtends[] {
  return [
    eslint.configs.recommended,
    {
      rules: {
        'accessor-pairs': 'error',
        'array-callback-return': 'error',
        'camelcase': 'error',
        'capitalized-comments': 'error',
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
            allowArrowFunctions: true
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
    }
  ];
}

function getEslintImportResolverTypescriptConfigs(): InfiniteDepthConfigWithExtends[] {
  return [
    {
      settings: {
        'import/resolver': {
          typescript: {
            alwaysTryTypes: true
          }
        }
      }
    }
  ];
}

function getImportXConfigs(): InfiniteDepthConfigWithExtends[] {
  return [
    eslintPluginImportXFlatConfigs.recommended,
    eslintPluginImportXFlatConfigs.typescript,
    eslintPluginImportXFlatConfigs.errors,
    eslintPluginImportXFlatConfigs.warnings,
    {
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
        'import-x/no-unused-modules': 'error',
        'import-x/no-useless-path-segments': 'error',
        'import-x/no-webpack-loader-syntax': 'error'
      }
    }
  ];
}

function getModulesNewlinesConfigs(): InfiniteDepthConfigWithExtends[] {
  return [
    {
      plugins: {
        'modules-newlines': eslintPluginModulesNewlines
      },
      rules: {
        'modules-newlines/export-declaration-newline': 'error',
        'modules-newlines/import-declaration-newline': 'error'
      }
    }
  ];
}

function getPerfectionistConfigs(): InfiniteDepthConfigWithExtends[] {
  return [
    perfectionist.configs['recommended-alphabetical']
  ];
}

function getStylisticConfigs(): InfiniteDepthConfigWithExtends[] {
  return [
    // eslint-disable-next-line import-x/no-named-as-default-member
    stylistic.configs.recommended,
    // eslint-disable-next-line import-x/no-named-as-default-member
    stylistic.configs.customize({
      arrowParens: true,
      braceStyle: '1tbs',
      commaDangle: 'never',
      semi: true
    }),
    {
      rules: {
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
            allowTemplateLiterals: false
          }
        ]
      }
    }
  ];
}

function getTseslintConfigs(): InfiniteDepthConfigWithExtends[] {
  return [
    // eslint-disable-next-line import-x/no-named-as-default-member
    ...tseslint.configs.strictTypeChecked.map(excludeFilesProperty),
    // eslint-disable-next-line import-x/no-named-as-default-member
    ...tseslint.configs.stylisticTypeChecked.map(excludeFilesProperty),
    {
      languageOptions: {
        parserOptions: {
          ecmaFeatures: {
            jsx: true
          },
          projectService: true,
          tsconfigRootDir: getRootDir() ?? ''
        }
      }
    },
    {
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'error',
        '@typescript-eslint/explicit-member-accessibility': 'error',
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
            args: 'all',
            argsIgnorePattern: '^_',
            caughtErrors: 'all',
            caughtErrorsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
            ignoreRestSiblings: true,
            varsIgnorePattern: '^_'
          }
        ]
      }
    },
    {
      settings: {
        react: {
          version: 'detect'
        }
      }
    }
  ];
}
