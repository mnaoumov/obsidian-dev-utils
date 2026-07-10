/**
 * @file
 *
 * Component that initializes the plugin context, debug controller, and library styles.
 */

import type { App } from 'obsidian';

import { Library } from '../../library.ts';
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
  /**
   * The Obsidian app instance.
   */
  protected readonly app: App;

  /**
   * The plugin ID used to initialize the plugin context and debug controller.
   */
  protected readonly pluginId: string;

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
    initPluginContext(this.pluginId);
    // Reset on unload so a plugin reload can re-initialize without tripping the once-only `Library.init` guard.
    this.register(() => {
      Library.resetToDefault();
    });
    this.addChild(new AllWindowsEventComponent(this.app)).registerAllWindowsHandler((win) => {
      initDebugController(win, this);
    });
  }
}
