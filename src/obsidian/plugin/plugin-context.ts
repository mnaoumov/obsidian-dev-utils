/**
 * @file
 *
 * Initializes the plugin context and sets up the plugin ID.
 */

import type {
  App,
  Component
} from 'obsidian';

import { compareVersions } from 'compare-versions';

import type { DebugController } from '../../debug-controller.ts';

import { CssClass } from '../../css-class.ts';
import {
  getDebugController,
  showInitialDebugMessage
} from '../../debug.ts';
import {
  LIBRARY_NAME,
  LIBRARY_STYLES,
  LIBRARY_VERSION
} from '../../library.ts';
import { getObsidianDevUtilsState } from '../app.ts';
import {
  getPluginId,
  setPluginId
} from './plugin-id.ts';

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
export function addPluginCssClasses(el: HTMLElement, ...cssClasses: string[]): void {
  el.addClass(CssClass.LibraryName, getPluginId(), ...cssClasses);
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

  activeDocument.head.querySelector(`#${STYLES_ID}`)?.remove();
  // eslint-disable-next-line obsidianmd/no-forbidden-elements -- We need to create a style element to apply the library styles.
  activeDocument.head.createEl('style', {
    attr: {
      id: STYLES_ID
    },
    text: LIBRARY_STYLES
  });
}
