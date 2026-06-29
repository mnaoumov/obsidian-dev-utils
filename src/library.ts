/**
 * @file
 *
 * Helpers for working with the `obsidian-dev-utils` library.
 */

/**
 * A name of the `obsidian-dev-utils` library.
 */
export const LIBRARY_NAME = 'obsidian-dev-utils';

/**
 * Process-wide cosmetic state for the `obsidian-dev-utils` library.
 *
 * The host plugin pushes these values once at initialization (see `initPluginContext`); the
 * Obsidian-runtime-agnostic core only ever reads them. The bag holds purely cosmetic strings and a
 * flag — deliberately NOT the plugin ID itself — so it cannot be used to reconstruct a capability
 * such as the plugin graph.
 */
export interface GlobalState {
  /**
   * The per-plugin CSS class scope applied alongside the library class by `addPluginCssClasses`.
   * Set to the plugin ID at initialization; empty until then.
   */
  cssClassScope: string;

  /**
   * The namespace prefix prepended to the library's debug namespaces (e.g. `${pluginId}:`). Set at
   * initialization so a plugin's library debuggers are namespaced under it; empty until then.
   */
  debugPrefixNamespace: string;

  /**
   * Whether debug logging should append a rich DevTools stack trace. Set to `true` at
   * initialization (the host runs inside Obsidian's DevTools-capable renderer); `false` until then.
   */
  shouldPrintStackTrace: boolean;
}

const DEFAULT_GLOBAL_STATE: GlobalState = {
  cssClassScope: '',
  debugPrefixNamespace: '',
  shouldPrintStackTrace: false
};

/**
 * The process-wide cosmetic {@link GlobalState} for the `obsidian-dev-utils` library. Written once at
 * initialization by the host plugin and read by the agnostic core.
 */
export const globalState: GlobalState = { ...DEFAULT_GLOBAL_STATE };

/**
 * Resets {@link globalState} back to its defaults.
 *
 * Intended for test isolation: call it before each test so values pushed by one test's
 * initialization do not leak into the next.
 */
export function resetGlobalState(): void {
  Object.assign(globalState, DEFAULT_GLOBAL_STATE);
}
