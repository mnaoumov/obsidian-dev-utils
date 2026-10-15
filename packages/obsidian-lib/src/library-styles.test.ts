// @vitest-environment jsdom

import { compareVersions } from 'compare-versions';
import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  injectLibraryStyles,
  LAST_OBSIDIAN_LIB_VERSION_KEY,
  LEGACY_LAST_LIBRARY_VERSION_KEY,
  LEGACY_LAST_LIBRARY_VERSION_SENTINEL,
  LIBRARY_STYLES_ELEMENT_ID
} from './library-styles.ts';
import {
  getObsidianDevUtilsState,
  resetObsidianDevUtilsState
} from './obsidian-dev-utils-state.ts';

const NEWEST_OBSIDIAN_DEV_UTILS_VERSION = '107.4.1';

describe('injectLibraryStyles', () => {
  beforeEach(() => {
    resetObsidianDevUtilsState();
    document.head.querySelector(`#${LIBRARY_STYLES_ELEMENT_ID}`)?.remove();
  });

  it('should inject the styles when no copy did yet', () => {
    injectStyles('1.0.0', '/* lib-1.0.0 */');
    expect(getInjectedStyles()).toEqual(['/* lib-1.0.0 */']);
    expect(getObsidianDevUtilsState(LAST_OBSIDIAN_LIB_VERSION_KEY, null).value).toBe('1.0.0');
  });

  it('should let a newer obsidian-lib copy replace an older one', () => {
    injectStyles('1.0.0', '/* lib-1.0.0 */');
    injectStyles('1.1.0', '/* lib-1.1.0 */');
    expect(getInjectedStyles()).toEqual(['/* lib-1.1.0 */']);
  });

  it('should keep the styles of a newer obsidian-lib copy when an older or equal one loads later', () => {
    injectStyles('1.1.0', '/* lib-1.1.0 */');
    injectStyles('1.0.0', '/* lib-1.0.0 */');
    injectStyles('1.1.0', '/* lib-1.1.0-again */');
    expect(getInjectedStyles()).toEqual(['/* lib-1.1.0 */']);
  });

  it('should replace the styles of an obsidian-dev-utils copy that loaded first', () => {
    injectLegacyObsidianDevUtilsStyles(NEWEST_OBSIDIAN_DEV_UTILS_VERSION, '/* odu */');
    expect(getInjectedStyles()).toEqual(['/* odu */']);

    injectStyles('1.0.0', '/* lib-1.0.0 */');
    expect(getInjectedStyles()).toEqual(['/* lib-1.0.0 */']);
  });

  it('should keep its styles when an obsidian-dev-utils copy loads later', () => {
    injectStyles('1.0.0', '/* lib-1.0.0 */');

    injectLegacyObsidianDevUtilsStyles(NEWEST_OBSIDIAN_DEV_UTILS_VERSION, '/* odu */');
    expect(getInjectedStyles()).toEqual(['/* lib-1.0.0 */']);
    expect(getObsidianDevUtilsState(LEGACY_LAST_LIBRARY_VERSION_KEY, '0.0.0').value).toBe(LEGACY_LAST_LIBRARY_VERSION_SENTINEL);
  });

  it('should keep obsidian-dev-utils copies out even when it injects nothing itself', () => {
    injectStyles('1.1.0', '/* lib-1.1.0 */');
    getObsidianDevUtilsState(LEGACY_LAST_LIBRARY_VERSION_KEY, '0.0.0').value = '0.0.0';
    injectStyles('1.0.0', '/* lib-1.0.0 */');

    injectLegacyObsidianDevUtilsStyles(NEWEST_OBSIDIAN_DEV_UTILS_VERSION, '/* odu */');
    expect(getInjectedStyles()).toEqual(['/* lib-1.1.0 */']);
  });
});

function getInjectedStyles(): string[] {
  return Array.from(document.head.querySelectorAll(`#${LIBRARY_STYLES_ELEMENT_ID}`), (element) => element.textContent);
}

/**
 * The injection every `obsidian-dev-utils` copy up to 107.x runs from `initPluginContext`, kept verbatim apart from
 * the parameters, so these tests play the real other side of the protocol.
 */
function injectLegacyObsidianDevUtilsStyles(libraryVersion: string, libraryStyles: string): void {
  const lastLibraryVersionWrapper = getObsidianDevUtilsState(LEGACY_LAST_LIBRARY_VERSION_KEY, '0.0.0');
  if (compareVersions(libraryVersion, lastLibraryVersionWrapper.value) <= 0) {
    return;
  }

  lastLibraryVersionWrapper.value = libraryVersion;

  document.head.querySelector(`#${LIBRARY_STYLES_ELEMENT_ID}`)?.remove();
  // eslint-disable-next-line obsidianmd/no-forbidden-elements -- This replays the legacy library's own style injection.
  document.head.createEl('style', {
    attr: {
      id: LIBRARY_STYLES_ELEMENT_ID
    },
    text: libraryStyles
  });
}

function injectStyles(libraryVersion: string, libraryStyles: string): void {
  injectLibraryStyles({ doc: document, libraryStyles, libraryVersion });
}
