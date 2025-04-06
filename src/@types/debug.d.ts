/**
 * @packageDocumentation debug
 * Fixed typings for the `debug` package.
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
