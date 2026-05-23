/**
 * @file
 *
 * Component that initializes the plugin context, debug controller, and library styles.
 */

import type { App } from 'obsidian';

import {
  initDebugController,
  initPluginContext
} from '../plugin/plugin-context.ts';
import { AllWindowsEventComponent } from './all-windows-event-component.ts';
import { ComponentEx } from './component-ex.ts';

interface PluginContextComponentConstructorParams {
  readonly app: App;
  readonly pluginId: string;
}

/**
 * Initializes plugin context (plugin ID, debug controller, library styles) on load.
 */
export class PluginContextComponent extends ComponentEx {
  private readonly app: App;
  private readonly pluginId: string;

  /**
   * Creates a new plugin context component.
   *
   * @param params - The constructor parameters.
   */
  public constructor(params: PluginContextComponentConstructorParams) {
    super();
    this.app = params.app;
    this.pluginId = params.pluginId;
  }

  /**
   * Initializes the plugin context and debug controller.
   */
  public override onload(): void {
    initPluginContext(this.app, this.pluginId);
    this.addChild(new AllWindowsEventComponent(this.app)).registerAllWindowsHandler((win) => {
      initDebugController(win, this);
    });
  }
}
