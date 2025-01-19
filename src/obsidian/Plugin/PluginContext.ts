import type { App } from 'obsidian';

import { compareVersions } from 'compare-versions';

import type { DebugController } from '../../DebugController.ts';

import stylesCss from '../../../static/styles.css';
import {
  getDebugController,
  showInitialDebugMessage
} from '../../Debug.ts';
import {
  LIBRARY_NAME,
  LIBRARY_VERSION
} from '../../Library.ts';
import { getObsidianDevUtilsState } from '../App.ts';
import { setPluginId } from './PluginId.ts';

interface PluginContextWindow {
  DEBUG: DebugController;
}

const STYLES_ID = `${LIBRARY_NAME}-styles`;

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

  document.head.querySelector(`#${STYLES_ID}`)?.remove();
  document.head.createEl('style', {
    attr: {
      id: STYLES_ID
    },
    text: stylesCss
  });
}

function getPluginContextWindow(): Partial<PluginContextWindow> {
  return window as Partial<PluginContextWindow>;
}
