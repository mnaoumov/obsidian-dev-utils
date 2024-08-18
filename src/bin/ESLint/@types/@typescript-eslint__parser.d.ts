/**
 * @fileoverview Module declaration for the `@typescript-eslint/parser` package.
 *
 * This module declaration defines the types for the parser exported by
 * `@typescript-eslint/parser`. The parser is used to parse TypeScript code
 * into an Abstract Syntax Tree (AST) that ESLint can work with.
 *
 * @module @typescript-eslint/parser
 * @see {@link https://www.npmjs.com/package/@typescript-eslint/parser} for more information.
 */

declare module "@typescript-eslint/parser" {
  import type { Linter } from "eslint";
  const parser: Linter.Parser;
  export default parser;
}
