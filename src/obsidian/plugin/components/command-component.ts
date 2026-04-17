/**
 * @file
 *
 * Component that wraps a single command and manages its registration with Obsidian.
 */

/* v8 ignore start -- Deeply coupled to Obsidian runtime; requires running vault for meaningful testing. */

import type { Plugin } from 'obsidian';

import { Component } from 'obsidian';

import type { CommandBase } from '../../commands/command.ts';

import { invokeAsyncSafely } from '../../../async.ts';

/**
 * Wraps a single {@link CommandBase} and registers it with Obsidian on load.
 * Consistent with {@link PluginSettingsTabComponent} which wraps {@link PluginSettingsTabBase}.
 *
 * @typeParam TPlugin - The type of the plugin.
 */
export class CommandComponent<TPlugin extends Plugin = Plugin> extends Component {
  /**
   * Creates a new command component.
   *
   * @param plugin - The Obsidian plugin instance.
   * @param command - The command to register.
   */
  public constructor(
    private readonly plugin: TPlugin,
    public readonly command: CommandBase<TPlugin>
  ) {
    super();
  }

  /**
   * Registers the command with Obsidian and triggers any additional event registrations.
   */
  public override onload(): void {
    this.plugin.addCommand(this.command);
    invokeAsyncSafely(() => this.command.onRegistered(this));
  }
}

/* v8 ignore stop */
