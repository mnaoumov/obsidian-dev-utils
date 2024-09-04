/**
 * @packageDocumentation eslint.config
 * ESLint configuration for TypeScript projects with various plugins.
 *
 * This module exports ESLint configurations for TypeScript projects, integrating multiple ESLint plugins
 * such as `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`,
 * `eslint-plugin-modules-newlines`, `@stylistic/eslint-plugin`, and `eslint-plugin-deprecation`.
 * It sets up parsers, plugins, and rules for maintaining code quality and consistency.
 *
 * @packageDocumentation eslint-config
 */

import stylisticEslintPlugin from '@stylistic/eslint-plugin';
import eslintPluginModulesNewlines from 'eslint-plugin-modules-newlines';
import 'eslint-import-resolver-typescript';
import type { Linter } from 'eslint';
import eslintPluginDeprecation from 'eslint-plugin-deprecation';
import { join } from '../../Path.ts';
import { ObsidianDevUtilsRepoPaths } from '../ObsidianDevUtilsRepoPaths.ts';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { getRootDir } from '../Root.ts';

export const configs: Linter.Config[] = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: getRootDir()
      }
    }
  },
  {
    files: [
      join(ObsidianDevUtilsRepoPaths.Src, ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyTs),
      join(ObsidianDevUtilsRepoPaths.Scripts, ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyTs)
    ],
    ignores: [
      join(ObsidianDevUtilsRepoPaths.SrcObsidianTypesDataview),
    ],
    plugins: {
      'modules-newlines': eslintPluginModulesNewlines,
      '@stylistic': stylisticEslintPlugin,
      deprecation: eslintPluginDeprecation
    },
    rules: {
      'modules-newlines/import-declaration-newline': 'error',
      'modules-newlines/export-declaration-newline': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@stylistic/indent': ['error', 2],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/brace-style': 'error',
      '@stylistic/arrow-parens': 'error',
      semi: 'error',
      'no-extra-semi': 'error',
      '@typescript-eslint/explicit-member-accessibility': 'error',
      curly: ['error'],
      'deprecation/deprecation': 'error'
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
