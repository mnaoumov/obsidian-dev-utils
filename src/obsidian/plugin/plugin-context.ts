/**
 * @file
 *
 * Initializes the plugin context and sets up the plugin ID.
 */

import type { Component } from 'obsidian';

import { compareVersions } from 'compare-versions';

import type { DebugController } from '../../debug-controller.ts';

import {
  getDebugController,
  showInitialDebugMessage
} from '../../debug.ts';
import {
  LIBRARY_STYLES,
  LIBRARY_VERSION
} from '../../generated-during-build.ts';
import {
  globalState,
  LIBRARY_NAME
} from '../../library.ts';
import { getObsidianDevUtilsState } from '../../obsidian-dev-utils-state.ts';
import { CssClass } from '../css-class.ts';

interface PluginContextWindow {
  DEBUG: DebugController | undefined;
}

const STYLES_ID = `${LIBRARY_NAME}-styles`;

/**
 * Sets the CSS class of an element.
 *
 * @param el - The element to set the CSS class of.
 * @param cssClasses - The CSS classes to set.
 */
export function addPluginCssClasses(el: HTMLElement, cssClasses?: string | string[]): void {
  const cssClassesArr: string[] = [CssClass.LibraryName];
  // The scope is empty until the plugin context is initialized; skip it so we never add an empty class.
  if (globalState.cssClassScope) {
    cssClassesArr.push(globalState.cssClassScope);
  }
  if (Array.isArray(cssClasses)) {
    cssClassesArr.push(...cssClasses);
  } else if (typeof cssClasses === 'string') {
    cssClassesArr.push(cssClasses);
  }
  el.addClass(...cssClassesArr);
}

/**
 * Initializes the debug controller.
 *
 * @param win - The window to initialize the debug controller for.
 * @param component - The component to register cleanup on.
 */
export function initDebugController(win: Window, component: Component): void {
  const pluginContextWindow = win as Partial<PluginContextWindow>;
  const oldDebug = pluginContextWindow.DEBUG;
  const newDebug = getDebugController();
  pluginContextWindow.DEBUG = newDebug;

  component.register(() => {
    if (pluginContextWindow.DEBUG === newDebug) {
      pluginContextWindow.DEBUG = oldDebug;
    }
  });
}

/**
 * Initializes the plugin context.
 *
 * @param pluginId - The plugin ID.
 */
export function initPluginContext(pluginId: string): void {
  globalState.cssClassScope = pluginId;
  globalState.debugPrefixNamespace = `${pluginId}:`;
  globalState.shouldPrintStackTrace = true;
  showInitialDebugMessage(pluginId);

  const lastLibraryVersionWrapper = getObsidianDevUtilsState('lastLibraryVersion', '0.0.0');
  if (compareVersions(LIBRARY_VERSION, lastLibraryVersionWrapper.value) <= 0) {
    return;
  }

  lastLibraryVersionWrapper.value = LIBRARY_VERSION;

  // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need to access document.
  document.head.querySelector(`#${STYLES_ID}`)?.remove();
  // eslint-disable-next-line obsidianmd/no-forbidden-elements, obsidianmd/prefer-active-doc -- We need to create a style element to apply the library styles.
  document.head.createEl('style', {
    attr: {
      id: STYLES_ID
    },
    text: LIBRARY_STYLES
  });
}
