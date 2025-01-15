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

import type { Linter } from 'eslint';

import eslint from '@eslint/js';
// eslint-disable-next-line import-x/no-rename-default
import stylistic from '@stylistic/eslint-plugin';
import eslintPluginImportX from 'eslint-plugin-import-x';
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
  eslint.configs.recommended,
  // eslint-disable-next-line import-x/no-named-as-default-member
  ...tseslint.configs.strictTypeChecked.map(excludeFilesProperty),
  // eslint-disable-next-line import-x/no-named-as-default-member
  ...tseslint.configs.stylisticTypeChecked.map(excludeFilesProperty),
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: getRootDir() ?? ''
      }
    }
  },
  // eslint-disable-next-line import-x/no-named-as-default-member
  stylistic.configs['recommended-flat'],
  // eslint-disable-next-line import-x/no-named-as-default-member
  stylistic.configs.customize({
    arrowParens: true,
    braceStyle: '1tbs',
    commaDangle: 'never',
    flat: true,
    semi: true
  }),
  eslintPluginImportX.flatConfigs.recommended,
  eslintPluginImportX.flatConfigs.typescript,
  eslintPluginImportX.flatConfigs.errors,
  eslintPluginImportX.flatConfigs.warnings,
  perfectionist.configs['recommended-alphabetical'],
  {
    files: [
      join(ObsidianDevUtilsRepoPaths.Src, ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyTs),
      join(ObsidianDevUtilsRepoPaths.Scripts, ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyTs)
    ],
    ignores: [
      join(ObsidianDevUtilsRepoPaths.SrcObsidianTypesDataview)
    ],
    plugins: {
      'modules-newlines': eslintPluginModulesNewlines
    },
    rules: {
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
      '@stylistic/quotes': [
        'error',
        'single',
        {
          allowTemplateLiterals: false
        }
      ],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-member-accessibility': 'error',
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
      ],
      'curly': ['error'],
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
      'import-x/no-unassigned-import': 'error',
      'import-x/no-unused-modules': 'error',
      'import-x/no-useless-path-segments': 'error',
      'import-x/no-webpack-loader-syntax': 'error',
      'modules-newlines/export-declaration-newline': 'error',
      'modules-newlines/import-declaration-newline': 'error'
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true
        }
      }
    }
  }
) as Linter.Config[];

function excludeFilesProperty<Config extends { files?: unknown }>(config: Config): Omit<Config, 'files'> {
  const { files: _files, ...configWithoutFiles } = config;
  return configWithoutFiles;
}
