/**
 * @file
 *
 * Initializes the plugin context and sets up the plugin ID.
 */

import type { DebugController } from '@mnaoumov/typescript-lib/debug-controller';
import type { Component } from 'obsidian';

import { getSharedAbortController } from '@mnaoumov/typescript-lib/abort-controller';
import {
  getDebugController,
  showInitialDebugMessage
} from '@mnaoumov/typescript-lib/debug';
import { Library } from '@mnaoumov/typescript-lib/library';

import { CssClass } from '../css-class.ts';
import {
  LIBRARY_STYLES,
  LIBRARY_VERSION
} from '../generated-during-build.ts';
import { injectLibraryStyles } from '../library-styles.ts';
import {
  OBSIDIAN_LIBRARY_NAME,
  ObsidianLibrary
} from '../library.ts';
import { shareTypescriptLibStateWithObsidianDevUtilsState } from '../obsidian-dev-utils-state.ts';

interface PluginContextWindow {
  DEBUG: DebugController | undefined;
}

const DEBUG_GUIDE_URL = 'https://mnaoumov.dev/obsidian-dev-utils/guides/debugging/';

/**
 * Sets the CSS class of an element.
 *
 * @param element - The element to set the CSS class of.
 * @param cssClasses - The CSS classes to set.
 */
export function addPluginCssClasses(element: HTMLElement, cssClasses?: string | string[]): void {
  const extraCssClasses = typeof cssClasses === 'string' ? [cssClasses] : cssClasses ?? [];
  element.addClass(
    CssClass.LibraryName,
    // The scope is empty until the plugin context is initialized; skip it so we never add an empty class.
    ...(ObsidianLibrary.cssClassScope ? [ObsidianLibrary.cssClassScope] : []),
    ...extraCssClasses
  );
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
  ObsidianLibrary.init({ cssClassScope: pluginId });
  Library.init({
    debugGuideUrl: DEBUG_GUIDE_URL,
    debugNamespace: OBSIDIAN_LIBRARY_NAME,
    debugPrefixNamespace: `${pluginId}:`,
    shouldPrintStackTrace: true
  });
  showInitialDebugMessage(pluginId);

  // Nothing else in the library reaches for the shared abort controller -- only consumer plugins do. Create
  // it here so `__obsidianDevUtils.sharedAbortController.value.abort()` always resolves in the devtools
  // console, instead of throwing until some plugin happens to start an abortable operation.
  getSharedAbortController();

  // The debuggers, the `debug` instance and the shared abort controller moved out of `__obsidianDevUtils`. Link them
  // back, so plugins bundling an older copy of this library share them, and the devtools line above keeps working.
  shareTypescriptLibStateWithObsidianDevUtilsState();

  injectLibraryStyles({
    doc: document,
    libraryStyles: LIBRARY_STYLES,
    libraryVersion: LIBRARY_VERSION
  });
}
