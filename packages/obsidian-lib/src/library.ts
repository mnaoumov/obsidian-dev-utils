/**
 * @file
 *
 * Helpers for working with the `@mnaoumov/obsidian-lib` library.
 *
 * The user-visible names — the debug namespace, the CSS class and the stylesheet id — stay `obsidian-dev-utils`,
 * the name this library was published under before it split into packages, so plugins, their users' debug
 * filters and their stylesheets keep matching.
 */

/**
 * The user-visible name of the library: its debug namespace, CSS class and stylesheet id.
 */
export const OBSIDIAN_LIBRARY_NAME = 'obsidian-dev-utils';

/**
 * Parameters for {@link ObsidianLibrary.init}.
 */
export interface ObsidianLibraryInitParams {
  /**
   * The per-plugin CSS class scope applied alongside the library class by `addPluginCssClasses`.
   */
  readonly cssClassScope: string;
}

const DEFAULT_PARAMS: ObsidianLibraryInitParams = {
  cssClassScope: ''
};

/**
 * The Obsidian half of the library's initialization state. `initPluginContext` initializes it beside the
 * generic `Library` from `@mnaoumov/typescript-lib/library`.
 */
class ObsidianLibraryContext {
  /**
   * The per-plugin CSS class scope applied alongside the library class by `addPluginCssClasses`.
   * Empty until {@link init} is called.
   *
   * @returns The CSS class scope.
   */
  public get cssClassScope(): string {
    return this.params.cssClassScope;
  }

  private isInitialized = false;

  private params: ObsidianLibraryInitParams = { ...DEFAULT_PARAMS };

  /**
   * Initializes the context. Must be called exactly once; calling it again before {@link resetToDefault} throws.
   *
   * @param params - The configuration to inject.
   */
  public init(params: ObsidianLibraryInitParams): void {
    if (this.isInitialized) {
      throw new Error(`${OBSIDIAN_LIBRARY_NAME} is already initialized. Call ObsidianLibrary.resetToDefault() before initializing again.`);
    }
    this.isInitialized = true;
    this.params = { ...params };
  }

  /**
   * Resets the context back to its default (uninitialized) state, allowing {@link init} to be called again.
   */
  public resetToDefault(): void {
    this.isInitialized = false;
    this.params = { ...DEFAULT_PARAMS };
  }
}

/**
 * The single {@link ObsidianLibraryContext} instance.
 */
export const ObsidianLibrary = new ObsidianLibraryContext();
