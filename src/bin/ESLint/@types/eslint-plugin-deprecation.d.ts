/**
 * @fileoverview Module declaration for the `eslint-plugin-deprecation` package.
 *
 * This module declaration defines the types for the plugin exported by
 * `eslint-plugin-deprecation`. The plugin provides rules for detecting and
 * reporting deprecated code patterns in your JavaScript or TypeScript code.
 *
 * @module eslint-plugin-deprecation
 * @see {@link https://www.npmjs.com/package/eslint-plugin-deprecation} for more information.
 */

declare module "eslint-plugin-deprecation" {
  import type { ESLint } from "eslint";

  const plugin: ESLint.Plugin;
  export default plugin;
}
