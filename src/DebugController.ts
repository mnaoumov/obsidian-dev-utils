/**
 * @packageDocumentation
 * Provides the interface for controlling debug output through namespace management.
 *
 * Debug namespaces follow the pattern 'foo', `foo:bar`, `foo:bar:baz`, etc, and can use wildcards (`*`).
 *
 * @example
 * - `foo:*` matches all submodules of 'foo'
 * - `*:bar` matches all plugins' `bar` submodules
 * - `*` matches everything
 *
 * Special syntax:
 * - Namespaces prefixed with '-' are explicitly disabled
 * - Multiple namespaces can be combined with commas: `foo,-foo:bar,baz:*`
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
   * window.DEBUG.disable('foo'); // hide all debug messages from the `foo` plugin
   * window.DEBUG.disable('foo:*'); // hide all debug messages from the `foo` plugin submodules
   * window.DEBUG.disable(['foo', 'bar']); // disable multiple namespaces
   * window.DEBUG.disable('foo,bar'); // disable multiple namespaces using comma-separated string
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
   * window.DEBUG.enable('foo'); // show all debug messages from the `foo` plugin
   * window.DEBUG.enable('foo:obsidian-dev-utils:*'); // show all debug messages from the `obsidian-dev-utils` library within the `foo` plugin
   * window.DEBUG.enable('foo:*'); // show all debug messages from the `foo` plugin and its submodules
   * window.DEBUG.enable('*:obsidian-dev-utils:*'); // show all debug messages for the `obsidian-dev-utils` library within any plugin
   * window.DEBUG.enable(['foo', 'bar']); // enable multiple namespaces
   * window.DEBUG.enable('foo,bar'); // enable multiple namespaces using comma-separated string
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
   * window.DEBUG.get(); // returns ['foo', 'bar:*', '-baz']
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
   * window.DEBUG.set(['foo', 'bar:*', '-baz']); // Enable 'foo' and 'bar:*', explicitly disable 'baz'
   * window.DEBUG.set('foo,bar:*,-baz'); // Same thing using comma-separated string
   * window.DEBUG.set('*'); // Enable all debug messages
   * window.DEBUG.set(''); // Disable all debug messages
   * ```
   *
   * @param namespaces - String or array of namespace patterns
   */
  set(namespaces: string | string[]): void;
}
