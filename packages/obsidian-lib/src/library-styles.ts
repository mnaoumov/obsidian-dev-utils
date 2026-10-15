/**
 * @file
 *
 * Injects the library's stylesheet once per renderer, letting the newest loaded copy win.
 *
 * Every plugin bundles its own copy, so several copies can share one renderer, and only one of them should own the
 * `<style>` element. Copies of the retired `obsidian-dev-utils` package decide that by comparing their own version
 * against `__obsidianDevUtils.lastLibraryVersion`. `obsidian-lib` restarted its version line, so it cannot take part in
 * that comparison: a `1.x` copy would lose to every `107.x` copy for ever. It therefore keeps its own record under a
 * separate key, and treats any `obsidian-dev-utils` copy as older than itself.
 */

import { compareVersions } from 'compare-versions';

import { OBSIDIAN_LIBRARY_NAME } from './library.ts';
import { getObsidianDevUtilsState } from './obsidian-dev-utils-state.ts';

/**
 * The id of the `<style>` element holding the library styles. It is the id `obsidian-dev-utils` copies use too, so
 * whichever copy injects last replaces the element instead of adding a second one.
 */
export const LIBRARY_STYLES_ELEMENT_ID = `${OBSIDIAN_LIBRARY_NAME}-styles`;

/**
 * The shared-state key under which `obsidian-lib` copies record the version that injected the styles.
 */
export const LAST_OBSIDIAN_LIB_VERSION_KEY = 'lastObsidianLibVersion';

/**
 * The shared-state key under which `obsidian-dev-utils` copies record the version that injected the styles.
 */
export const LEGACY_LAST_LIBRARY_VERSION_KEY = 'lastLibraryVersion';

/**
 * The value `obsidian-lib` writes under {@link LEGACY_LAST_LIBRARY_VERSION_KEY}. It is above every
 * `obsidian-dev-utils` version, so an `obsidian-dev-utils` copy loading later compares lower and leaves the styles
 * alone.
 */
export const LEGACY_LAST_LIBRARY_VERSION_SENTINEL = '999999999.0.0';

/**
 * Params for {@link injectLibraryStyles}.
 */
export interface InjectLibraryStylesParams {
  /**
   * The document whose `<head>` receives the `<style>` element.
   */
  readonly doc: Document;

  /**
   * The CSS to inject.
   */
  readonly libraryStyles: string;

  /**
   * The version of this `obsidian-lib` copy.
   */
  readonly libraryVersion: string;
}

/**
 * Injects the library styles, unless an `obsidian-lib` copy of the same or a newer version already did.
 *
 * A style element left by an `obsidian-dev-utils` copy is always replaced, whatever its version.
 *
 * @param params - The {@link InjectLibraryStylesParams}.
 */
export function injectLibraryStyles(params: InjectLibraryStylesParams): void {
  const { doc, libraryStyles, libraryVersion } = params;

  // Set before the early return, so an `obsidian-dev-utils` copy loading after any `obsidian-lib` copy stays out.
  getObsidianDevUtilsState(LEGACY_LAST_LIBRARY_VERSION_KEY, '0.0.0').value = LEGACY_LAST_LIBRARY_VERSION_SENTINEL;

  const lastVersionWrapper = getObsidianDevUtilsState<null | string>(LAST_OBSIDIAN_LIB_VERSION_KEY, null);
  if (lastVersionWrapper.value !== null && compareVersions(libraryVersion, lastVersionWrapper.value) <= 0) {
    return;
  }

  lastVersionWrapper.value = libraryVersion;

  doc.head.querySelector(`#${LIBRARY_STYLES_ELEMENT_ID}`)?.remove();
  // eslint-disable-next-line obsidianmd/no-forbidden-elements -- We need to create a style element to apply the library styles.
  doc.head.createEl('style', {
    attr: {
      id: LIBRARY_STYLES_ELEMENT_ID
    },
    text: libraryStyles
  });
}
