/**
 * @fileoverview Module declaration for the `eslint-plugin-modules-newlines` package.
 *
 * This module declaration defines the types for the plugin exported by
 * `eslint-plugin-modules-newlines`. The plugin provides rules for enforcing consistent newlines in module import/export declarations.
 *
 * @module eslint-plugin-modules-newlines
 * @see {@link https://www.npmjs.com/package/eslint-plugin-modules-newlines} for more information.
 */

declare module "eslint-plugin-modules-newlines" {
  import type { ESLint } from "eslint";
  const plugin: ESLint.Plugin;
  export default plugin;
}
