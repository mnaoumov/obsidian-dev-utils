/**
 * @packageDocumentation
 *
 * Provides the interface for controlling debug output through namespace management.
 *
 * Debug namespaces follow the pattern 'lorem', `lorem:ipsum`, `lorem:ipsum:dolor`, etc, and can use wildcards (`*`).
 *
 * @example
 * - `lorem:*` matches all submodules of 'lorem'
 * - `*:ipsum` matches all plugins' `ipsum` submodules
 * - `*` matches everything
 *
 * Special syntax:
 * - Namespaces prefixed with '-' are explicitly disabled
 * - Multiple namespaces can be combined with commas: `lorem,-lorem:ipsum,dolor:*`
 *
 * @see {@link https://github.com/mnaoumov/obsidian-dev-utils/?tab=readme-ov-file#debugging}
 */

/**
 * Controls debug output by managing debug namespaces.
 * Exposed globally as `window.DEBUG`.
 *
 * @remarks
 * Debug settings persist across plugin reloads in localStorage.
 */
export interface DebugController {
  /**
   * Disable specific debug namespaces. Disabled namespaces take precedence
   * over enabled ones when there's a conflict.
   *
   * @example
   * ```typescript
   * window.DEBUG.disable('foo-bar'); // hide all debug messages from the `foo-bar` plugin
   * window.DEBUG.disable('foo-bar:*'); // hide all debug messages from the `foo-bar` plugin submodules
   * window.DEBUG.disable(['foo-bar', 'baz-qux']); // disable multiple namespaces
   * window.DEBUG.disable('foo-bar,baz-qux'); // disable multiple namespaces using comma-separated string
   * window.DEBUG.disable('*'); // disable all debug messages
   * ```
   *
   * @param namespaces - Single namespace string or array of namespace strings to disable
   */
  disable(namespaces: string | string[]): void;

  /**
   * Enable specific debug namespaces. Note that explicitly disabled
   * namespaces (prefixed with '-') will remain disabled.
   *
   * @example
   * ```typescript
   * window.DEBUG.enable('foo-bar'); // show all debug messages from the `foo-bar` plugin
   * window.DEBUG.enable('foo-bar:obsidian-dev-utils:*'); // show all debug messages from the `obsidian-dev-utils` library within the `foo-bar` plugin
   * window.DEBUG.enable('foo-bar:*'); // show all debug messages from the `foo-bar` plugin and its submodules
   * window.DEBUG.enable('*:obsidian-dev-utils:*'); // show all debug messages for the `obsidian-dev-utils` library within any plugin
   * window.DEBUG.enable(['foo-bar', 'baz-qux']); // enable multiple namespaces
   * window.DEBUG.enable('foo-bar,baz-qux'); // enable multiple namespaces using comma-separated string
   * window.DEBUG.enable('*'); // show all debug messages
   * ```
   *
   * @param namespaces - Single namespace string or array of namespace strings to enable
   */
  enable(namespaces: string | string[]): void;

  /**
   * Get currently configured debug namespaces.
   *
   * @example
   * ```typescript
   * window.DEBUG.get(); // returns ['foo-bar', 'baz-qux:*', '-lorem-ipsum']
   * ```
   *
   * @returns Array of enabled and disabled (prefixed with `-`) debug namespaces
   */
  get(): string[];

  /**
   * Set debug namespaces, replacing all previous configurations.
   *
   * @example
   * ```typescript
   * window.DEBUG.set(['foo-bar', 'baz-qux:*', '-lorem-ipsum']); // Enable 'foo-bar' and 'baz-qux:*', explicitly disable 'lorem-ipsum'
   * window.DEBUG.set('foo-bar,baz-qux:*,-lorem-ipsum'); // Same thing using comma-separated string
   * window.DEBUG.set('*'); // Enable all debug messages
   * window.DEBUG.set(''); // Disable all debug messages
   * ```
   *
   * @param namespaces - String or array of namespace patterns
   */
  set(namespaces: string | string[]): void;
}
