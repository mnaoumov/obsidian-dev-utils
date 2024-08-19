/**
 * @file Module declaration for the `eslint-plugin-import` package.
 *
 * This module declaration defines the types for the plugin exported by
 * `eslint-plugin-import`. The plugin provides rules for managing ES6+ import/export syntax and import resolution.
 *
 * @module eslint-plugin-import
 * @see {@link https://www.npmjs.com/package/eslint-plugin-import} for more information.
 */

declare module "eslint-plugin-import" {
  import type { ESLint } from "eslint";
  const plugin: ESLint.Plugin;
  export default plugin;
}
