/**
 * @packageDocumentation
 *
 * Base classes for commands.
 */

import type {
  App,
  Command,
  IconName,
  Plugin
} from 'obsidian';

import { invokeAsyncSafely } from '../../Async.ts';

/**
 * Options for creating a command.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export interface CommandBaseOptions<TPlugin extends Plugin> {
  /**
   * The icon to use for the command.
   */
  icon: IconName;

  /**
   * The ID of the command.
   */
  id: string;

  /**
   * The name of the command.
   */
  name: string;

  /**
   * The plugin that the command belongs to.
   */
  plugin: TPlugin;
}

/**
 * Base class for commands.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class CommandBase<TPlugin extends Plugin> implements Command {
  public icon: IconName;
  public id: string;
  public name: string;
  protected readonly app: App;
  protected readonly plugin: TPlugin;

  /**
   * Creates a new command.
   *
   * @param options - The options for the command.
   */
  public constructor(options: CommandBaseOptions<TPlugin>) {
    this.id = options.id;
    this.name = options.name;
    this.icon = options.icon;
    this.plugin = options.plugin;
    this.app = this.plugin.app;
  }

  /**
   * Registers the command.
   */
  public register(): void {
    this.plugin.addCommand(this);
  }
}

/**
 * Base class for command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class CommandInvocationBase<TPlugin extends Plugin = Plugin> {
  protected readonly app: App;
  private lastCanExecuteResult?: boolean;

  /**
   * Creates a new command invocation.
   *
   * @param plugin - The plugin that the command invocation belongs to.
   */
  public constructor(protected readonly plugin: TPlugin) {
    this.app = plugin.app;
  }

  /**
   * Invokes the command.
   *
   * @param checking - Is checking mode only. If `true`, only the check if the command can execute is performed. If `false`, the command is executed.
   * @returns Whether the command was executed.
   */
  public invoke(checking: boolean): boolean {
    this.lastCanExecuteResult = this.canExecute();
    if (!checking && this.lastCanExecuteResult) {
      invokeAsyncSafely(() => this.execute());
    }

    return this.lastCanExecuteResult;
  }

  /**
   * Checks if the command can execute.
   *
   * @returns Whether the command can execute.
   */
  protected canExecute(): boolean {
    return true;
  }

  /**
   * Executes the command.
   */
  protected async execute(): Promise<void> {
    if (this.lastCanExecuteResult === undefined) {
      throw new Error('canExecute() must be called before execute()');
    }
    if (!this.lastCanExecuteResult) {
      throw new Error('canExecute() must return true before execute()');
    }
    await Promise.resolve();
  }
}
