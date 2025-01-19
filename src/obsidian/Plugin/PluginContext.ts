import type { App } from 'obsidian';

import { compareVersions } from 'compare-versions';

import type { DebugController } from '../../DebugController.ts';

import {
  getDebugController,
  showInitialDebugMessage
} from '../../Debug.ts';
import { LIBRARY_VERSION } from '../../Library.ts';
import { getObsidianDevUtilsState } from '../App.ts';
import { setPluginId } from './PluginId.ts';

interface PluginContextWindow {
  DEBUG: DebugController;
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

  const lastLibraryVersionWrapper = getObsidianDevUtilsState(app, 'lastLibraryVersion', '');
  if (compareVersions(LIBRARY_VERSION, lastLibraryVersionWrapper.value) >= 0) {
    return;
  }

  lastLibraryVersionWrapper.value = LIBRARY_VERSION;

  const pluginContextWindow = getPluginContextWindow();
  pluginContextWindow.DEBUG = getDebugController();
}

function getPluginContextWindow(): Partial<PluginContextWindow> {
  return window as Partial<PluginContextWindow>;
}
