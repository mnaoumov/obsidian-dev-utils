/**
 * @fileoverview Module declaration for the `@stylistic/eslint-plugin` package.
 *
 * This module declaration defines the types for the ESLint plugin exported by
 * `@stylistic/eslint-plugin`. The plugin is used to enforce stylistic rules
 * in ESLint configurations.
 *
 * @module @stylistic/eslint-plugin
 * @see {@link https://www.npmjs.com/package/@stylistic/eslint-plugin} for more information.
 */

declare module "@stylistic/eslint-plugin" {
  import type { ESLint } from "eslint";
  const plugin: ESLint.Plugin;
  export default plugin;
}
