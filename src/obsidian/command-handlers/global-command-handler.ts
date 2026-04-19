/**
 * @file
 *
 * Command handler for global (non-editor, non-file) commands.
 */

import type { Command } from 'obsidian';

import type { CommandHandlerParams } from './command-handler.ts';

import { invokeAsyncSafely } from '../../async.ts';
import { CommandHandler } from './command-handler.ts';

/**
 * Command handler for global commands invoked from the command palette.
 *
 * Subclasses override {@link canExecute} and {@link execute} to provide behavior.
 */
export abstract class GlobalCommandHandler extends CommandHandler {
  /**
   * Creates a new global command handler.
   *
   * @param params - The parameters for the command handler.
   */
  public constructor(params: CommandHandlerParams) {
    super(params);
  }

  /**
   * Builds a plain Obsidian {@link Command} object with a `checkCallback`.
   *
   * @returns A new {@link Command} object.
   */
  public override buildCommand(): Command {
    return {
      checkCallback: (checking) => this.checkCallback(checking),
      icon: this.icon,
      id: this.id,
      name: this.name
    };
  }

  /**
   * Checks whether the command can currently execute.
   *
   * @returns Whether the command can execute.
   */
  protected canExecute(): boolean {
    return true;
  }

  /**
   * Executes the command.
   */
  protected abstract execute(): Promise<void>;

  private checkCallback(checking: boolean): boolean {
    if (!this.canExecute()) {
      return false;
    }

    if (!checking) {
      invokeAsyncSafely(() => this.execute());
    }

    return true;
  }
}
