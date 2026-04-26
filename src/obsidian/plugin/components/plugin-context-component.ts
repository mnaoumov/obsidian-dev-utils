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

interface PluginContextComponentConstructorParams {
  readonly app: App;
  readonly pluginId: string;
}

/**
 * Initializes plugin context (plugin ID, debug controller, library styles) on load.
 */
export class PluginContextComponent extends Component {
  /**
   * The singleton key for the {@link PluginContextComponent} class.
   */
  public static readonly COMPONENT_KEY = Symbol(PluginContextComponent.name);
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
    new AllWindowsEventHandler(this.app, this).registerAllWindowsHandler((win) => {
      initDebugController(win, this);
    });
  }
}
