/**
 * @file ESLint configuration for TypeScript projects with various plugins.
 *
 * This module exports ESLint configurations for TypeScript projects, integrating multiple ESLint plugins
 * such as `@typescript-eslint/parser`, `eslint-plugin-import`, `@typescript-eslint/eslint-plugin`,
 * `eslint-plugin-modules-newlines`, `@stylistic/eslint-plugin`, and `eslint-plugin-deprecation`.
 * It sets up parsers, plugins, and rules for maintaining code quality and consistency.
 *
 * @module eslint-config
 */

import typescriptEslintParser from "@typescript-eslint/parser";
import eslintPluginImport from "eslint-plugin-import";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import stylisticEslintPlugin from "@stylistic/eslint-plugin";
import eslintPluginModulesNewlines from "eslint-plugin-modules-newlines";
import globals from "globals";
import "eslint-import-resolver-typescript";
import type { Linter } from "eslint";
import eslintPluginDeprecation from "eslint-plugin-deprecation";
import {
  join,
  normalizeIfRelative
} from "../../Path.ts";
import { ObsidianDevUtilsRepoPaths } from "../ObsidianDevUtilsRepoPaths.ts";

/**
 * ESLint configurations for TypeScript files.
 *
 * This configuration applies to TypeScript files in the source and script directories. It sets up the TypeScript
 * parser and plugins, defines a set of rules for code style and error checking, and includes settings for import resolution.
 *
 * @type {Linter.Config[]}
 */
export const configs: Linter.Config[] = [
  {
    files: [
      join(ObsidianDevUtilsRepoPaths.Src, ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyTs),
      join(ObsidianDevUtilsRepoPaths.Scripts, ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyTs)
    ],
    ignores: [
      join(ObsidianDevUtilsRepoPaths.SrcObsidianTypesDataview),
    ],
    languageOptions: {
      parser: typescriptEslintParser,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {
        project: normalizeIfRelative(ObsidianDevUtilsRepoPaths.TsConfigJson)
      }
    },
    plugins: {
      "@typescript-eslint": typescriptEslintPlugin,
      "import": eslintPluginImport,
      "modules-newlines": eslintPluginModulesNewlines,
      "@stylistic": stylisticEslintPlugin,
      deprecation: eslintPluginDeprecation
    },
    rules: {
      ...typescriptEslintPlugin.configs["eslint-recommended"]!.overrides[0]!.rules,
      ...typescriptEslintPlugin.configs["recommended"]!.rules,
      ...typescriptEslintPlugin.configs["recommended-type-checked"]!.rules,
      "import/no-unresolved": "error",
      "import/no-namespace": "error",
      "modules-newlines/import-declaration-newline": "error",
      "modules-newlines/export-declaration-newline": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@stylistic/indent": ["error", 2],
      "@stylistic/quotes": ["error", "double"],
      "@stylistic/brace-style": "error",
      "@stylistic/arrow-parens": "error",
      semi: "error",
      "no-extra-semi": "error",
      "@typescript-eslint/explicit-member-accessibility": "error",
      curly: ["error"],
      "deprecation/deprecation": "error"
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true
        }
      }
    }
  }
];
