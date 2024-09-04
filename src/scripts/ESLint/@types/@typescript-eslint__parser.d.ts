/**
 * @packageDocumentation \@typescript-eslint/parser
 * @see {@link https://www.npmjs.com/package/@typescript-eslint/parser} for more information.
 */

declare module "@typescript-eslint/parser" {
  import type { Linter } from "eslint";
  const parser: Linter.Parser;
  export default parser;
}
