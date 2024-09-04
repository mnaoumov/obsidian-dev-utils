/**
 * @packageDocumentation globals
 * @see {@link https://www.npmjs.com/package/globals} for more information.
 */

declare module 'globals' {
  type Globals = Record<string, boolean | 'writable' | 'readonly' | 'off'>;

  const globals: {
    browser: Globals;
    node: Globals;
  };
  export default globals;
}
