declare module "@typescript-eslint/parser" {
  import type { Linter } from "eslint";
  const parser: Linter.Parser;
  export default parser;
}
