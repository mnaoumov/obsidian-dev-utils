/**
 * @fileoverview Module declaration for the `@typescript-eslint/eslint-plugin` package.
 *
 * This module declaration defines the types for the ESLint plugin exported by
 * `@typescript-eslint/eslint-plugin`. The plugin provides rules and configurations
 * specific to TypeScript in ESLint.
 *
 * @module @typescript-eslint/eslint-plugin
 * @see {@link https://www.npmjs.com/package/@typescript-eslint/eslint-plugin} for more information.
 */

declare module "@typescript-eslint/eslint-plugin" {
  import type {
    ESLint,
    Linter
  } from "eslint";

  type Config = {
    overrides: Config[];
    rules: Linter.RulesRecord;
  }

  const plugin: ESLint.Plugin & {
    configs: Record<string, Config>
  };
  export default plugin;
}
