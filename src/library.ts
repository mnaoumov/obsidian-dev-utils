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
 * Parameters for {@link Library.init}.
 *
 * These are purely cosmetic values the host plugin injects once at initialization — deliberately NOT
 * the plugin ID itself, so the agnostic core cannot reconstruct a capability from them.
 */
export interface LibraryInitParams {
  /**
   * The per-plugin CSS class scope applied alongside the library class by `addPluginCssClasses`.
   */
  readonly cssClassScope: string;

  /**
   * The namespace prefix prepended to the library's debug namespaces (e.g. `${pluginId}:`).
   */
  readonly debugPrefixNamespace: string;

  /**
   * Whether debug logging should append a rich DevTools stack trace.
   */
  readonly shouldPrintStackTrace: boolean;
}

const DEFAULT_PARAMS: LibraryInitParams = {
  cssClassScope: '',
  debugPrefixNamespace: '',
  shouldPrintStackTrace: false
};

/**
 * The single, deterministic initialization entry point for the `obsidian-dev-utils` library.
 *
 * The host plugin calls {@link Library.init} exactly once (via `initPluginContext`) to push the
 * cosmetic per-plugin configuration; the Obsidian-runtime-agnostic core only reads it through the
 * getters. Calling {@link Library.init} more than once throws — {@link Library.resetToDefault} clears
 * the state (e.g. between tests, or on plugin unload) and allows re-initialization.
 */
class LibraryContext {
  /**
   * The per-plugin CSS class scope applied alongside the library class by `addPluginCssClasses`.
   * Empty until {@link init} is called.
   *
   * @returns The CSS class scope.
   */
  public get cssClassScope(): string {
    return this.params.cssClassScope;
  }

  /**
   * The namespace prefix prepended to the library's debug namespaces. Empty until {@link init} is called.
   *
   * @returns The debug namespace prefix.
   */
  public get debugPrefixNamespace(): string {
    return this.params.debugPrefixNamespace;
  }

  /**
   * Whether debug logging should append a rich DevTools stack trace. `false` until {@link init} is called.
   *
   * @returns Whether to print stack traces.
   */
  public get shouldPrintStackTrace(): boolean {
    return this.params.shouldPrintStackTrace;
  }

  private isInitialized = false;

  private params: LibraryInitParams = { ...DEFAULT_PARAMS };

  /**
   * Initializes the library with the host plugin's cosmetic configuration. Must be called exactly
   * once; calling it again before {@link resetToDefault} throws.
   *
   * @param params - The cosmetic configuration to inject.
   */
  public init(params: LibraryInitParams): void {
    if (this.isInitialized) {
      throw new Error(`${LIBRARY_NAME} is already initialized. Call Library.resetToDefault() before initializing again.`);
    }
    this.isInitialized = true;
    this.params = { ...params };
  }

  /**
   * Resets the library back to its default (uninitialized) state, allowing {@link init} to be called again.
   */
  public resetToDefault(): void {
    this.isInitialized = false;
    this.params = { ...DEFAULT_PARAMS };
  }
}

/**
 * The single {@link LibraryContext} instance — the library's deterministic initialization entry point.
 */
export const Library = new LibraryContext();
