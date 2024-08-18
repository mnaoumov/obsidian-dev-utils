/**
 * @fileoverview Module declaration for the `globals` package.
 *
 * This module declaration defines the types for the `globals` package, which provides a set of global variable definitions
 * for different environments such as `browser` and `node`. It helps in specifying which global variables are available
 * in the respective environments and their read/write status.
 *
 * @module globals
 * @see {@link https://www.npmjs.com/package/globals} for more information.
 */

declare module "globals" {
  type Globals = {
    [name: string]: boolean | "writable" | "readonly" | "off";
  };

  const globals: {
    browser: Globals;
    node: Globals;
  };
  export default globals;
}
