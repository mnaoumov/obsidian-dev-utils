/**
 * @file
 *
 * Helpers for working with the `@mnaoumov/typescript-lib` library.
 */

/**
 * A name of the `@mnaoumov/typescript-lib` library.
 */
export const LIBRARY_NAME = '@mnaoumov/typescript-lib';

/**
 * The debug namespace the library's own debuggers live under until {@link Library.init} supplies another.
 */
export const DEFAULT_DEBUG_NAMESPACE = 'typescript-lib';

/**
 * Parameters for {@link Library.init}.
 *
 * These are purely cosmetic values the host injects once at initialization, so the library itself carries
 * no knowledge of who hosts it.
 */
export interface LibraryInitParams {
  /**
   * The URL of the guide explaining how to turn debug messages on and off, named in the library's debug messages.
   * Without one, the messages name no guide.
   */
  readonly debugGuideUrl?: string;

  /**
   * The namespace the library's own debuggers live under. Defaults to {@link DEFAULT_DEBUG_NAMESPACE}.
   * A host that publishes its own debug namespace to its users passes it here, so their filters keep matching.
   */
  readonly debugNamespace?: string;

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
  debugPrefixNamespace: '',
  shouldPrintStackTrace: false
};

/**
 * The single, deterministic initialization entry point for the `@mnaoumov/typescript-lib` library.
 *
 * The host calls {@link Library.init} exactly once to push its cosmetic configuration; the library only
 * reads it through the getters. Calling {@link Library.init} more than once throws —
 * {@link Library.resetToDefault} clears the state (e.g. between tests, or on unload) and allows
 * re-initialization.
 */
class LibraryContext {
  /**
   * The URL of the guide explaining how to turn debug messages on and off. Empty until {@link init} is called with one.
   *
   * @returns The debug guide URL.
   */
  public get debugGuideUrl(): string {
    return this.params.debugGuideUrl ?? '';
  }

  /**
   * The namespace the library's own debuggers live under.
   *
   * @returns The debug namespace.
   */
  public get debugNamespace(): string {
    return this.params.debugNamespace ?? DEFAULT_DEBUG_NAMESPACE;
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
   * Initializes the library with the host's cosmetic configuration. Must be called exactly once; calling it
   * again before {@link resetToDefault} throws.
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
