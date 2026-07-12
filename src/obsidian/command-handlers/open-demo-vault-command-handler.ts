/**
 * @file
 *
 * Handles the "Open demo vault" command.
 */

import type {
  App,
  PluginManifest
} from 'obsidian';

import { Platform } from 'obsidian';

import type { PluginNoticeComponent } from '../components/plugin-notice-component.ts';

import { openDemoVault } from '../demo-vault-opener.ts';
import { GlobalCommandHandler } from './global-command-handler.ts';

/**
 * Constructor parameters for {@link OpenDemoVaultCommandHandler}.
 */
export interface OpenDemoVaultCommandHandlerConstructorParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The manifest of the plugin whose demo vault the command opens.
   */
  readonly manifest: PluginManifest;

  /**
   * The notice component used to report problems while opening the demo vault.
   */
  readonly pluginNoticeComponent: PluginNoticeComponent;
}

/**
 * A command handler that downloads and opens the plugin's shipped demo vault in a new window. Only
 * available on desktop — {@link canExecute} returns `false` on mobile, so the command is hidden there
 * (no mobile notice).
 */
export class OpenDemoVaultCommandHandler extends GlobalCommandHandler {
  /**
   * The Obsidian app instance.
   */
  protected readonly app: App;

  /**
   * The manifest of the plugin whose demo vault the command opens.
   */
  protected readonly manifest: PluginManifest;

  /**
   * The notice component used to report problems while opening the demo vault.
   */
  protected readonly pluginNoticeComponent: PluginNoticeComponent;

  /**
   * Constructs a new instance.
   *
   * @param params - Constructor parameters.
   */
  public constructor(params: OpenDemoVaultCommandHandlerConstructorParams) {
    super({
      icon: 'download',
      id: 'open-demo-vault',
      name: 'Open demo vault'
    });

    this.app = params.app;
    this.manifest = params.manifest;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
  }

  /**
   * Executes the command, opening the plugin's demo vault.
   */
  public override async execute(): Promise<void> {
    await openDemoVault({
      app: this.app,
      manifest: this.manifest,
      pluginNoticeComponent: this.pluginNoticeComponent
    });
  }

  /**
   * Checks whether the command can currently execute: only on desktop.
   *
   * @returns Whether the app is running on desktop.
   */
  protected override canExecute(): boolean {
    return Platform.isDesktopApp;
  }
}
