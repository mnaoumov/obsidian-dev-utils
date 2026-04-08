/**
 * @file
 *
 * Fixed typings for the `debug` package.
 *
 * @see {@link https://www.npmjs.com/package/debug} for more information.
 */

export {};

declare module 'debug' {
  interface Debug {
    /**
     * Loads the debug configuration from the environment.
     *
     * @returns The loaded debug configuration.
     */
    load(): null | string;
  }
}
