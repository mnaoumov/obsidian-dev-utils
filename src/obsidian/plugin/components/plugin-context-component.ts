/**
 * @file
 *
 * Component that initializes the plugin context, debug controller, and library styles.
 */

import type { App } from 'obsidian';

import { Component } from 'obsidian';

import { AllWindowsEventHandler } from '../../components/all-windows-event-handler.ts';
import {
  initDebugController,
  initPluginContext
} from '../plugin-context.ts';

/**
 * Initializes plugin context (plugin ID, debug controller, library styles) on load.
 */
export class PluginContextComponent extends Component {
  /**
   * Creates a new plugin context component.
   *
   * @param app - The Obsidian app instance.
   * @param pluginId - The plugin ID.
   */
  public constructor(
    private readonly app: App,
    private readonly pluginId: string
  ) {
    super();
  }

  /**
   * Initializes the plugin context and debug controller.
   */
  public override onload(): void {
    initPluginContext(this.app, this.pluginId);
    new AllWindowsEventHandler(this.app, this).registerAllWindowsHandler((win) => {
      initDebugController(win, this);
    });
  }
}
