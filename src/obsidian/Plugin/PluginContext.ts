/**
 * @packageDocumentation
 *
 * Initializes the plugin context and sets up the plugin ID.
 */

import type { App } from 'obsidian';

import { compareVersions } from 'compare-versions';

import type { DebugController } from '../../DebugController.ts';

import { CssClass } from '../../CssClass.ts';
import {
  getDebugController,
  showInitialDebugMessage
} from '../../Debug.ts';
import {
  LIBRARY_NAME,
  LIBRARY_STYLES,
  LIBRARY_VERSION
} from '../../Library.ts';
import { getObsidianDevUtilsState } from '../App.ts';
import {
  getPluginId,
  setPluginId
} from './PluginId.ts';

interface PluginContextWindow {
  DEBUG: DebugController;
}

const STYLES_ID = `${LIBRARY_NAME}-styles`;

/**
 * Sets the CSS class of an element.
 *
 * @param el - The element to set the CSS class of.
 * @param cssClasses - The CSS classes to set.
 */
export function addPluginCssClasses(el: HTMLElement, ...cssClasses: string[]): void {
  el.addClass(CssClass.LibraryName, getPluginId(), ...cssClasses);
}

/**
 * Initializes the debug controller.
 *
 * @param win - The window to initialize the debug controller for.
 */
export function initDebugController(win: Window): void {
  const pluginContextWindow = win as Partial<PluginContextWindow>;
  pluginContextWindow.DEBUG = getDebugController();
}

/**
 * Initializes the plugin context.
 *
 * @param app - The Obsidian app instance.
 * @param pluginId - The plugin ID.
 */
export function initPluginContext(app: App, pluginId: string): void {
  setPluginId(pluginId);
  showInitialDebugMessage(pluginId);

  const lastLibraryVersionWrapper = getObsidianDevUtilsState(app, 'lastLibraryVersion', '0.0.0');
  if (compareVersions(LIBRARY_VERSION, lastLibraryVersionWrapper.value) <= 0) {
    return;
  }

  lastLibraryVersionWrapper.value = LIBRARY_VERSION;

  document.head.querySelector(`#${STYLES_ID}`)?.remove();
  // eslint-disable-next-line obsidianmd/no-forbidden-elements -- We need to create a style element to apply the library styles.
  document.head.createEl('style', {
    attr: {
      id: STYLES_ID
    },
    text: LIBRARY_STYLES
  });
}
