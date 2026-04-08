/**
 * @file
 *
 * Base classes for non-editor commands.
 */

/* v8 ignore start -- Deeply coupled to Obsidian runtime; requires running vault for meaningful testing. */

import type { Plugin } from 'obsidian';

import type {
  CommandBaseParams,
  CommandInvocationBase
} from './command-base.ts';

import { CommandBase } from './command-base.ts';

/**
 * Base class for non-editor commands.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class NonEditorCommandBase<TPlugin extends Plugin> extends CommandBase<TPlugin> {
  /**
   * Creates a new non-editor command.
   *
   * @param params - The parameters for the non-editor command.
   */
  public constructor(params: CommandBaseParams<TPlugin>) {
    super(params);

    this.checkCallback = this.checkCallback.bind(this);
  }

  /**
   * Checks if the command can execute or executes it.
   *
   * @param checking - Is checking mode only. If `true`, only the check if the command can execute is performed. If `false`, the command is executed.
   * @returns Whether the command can execute.
   */
  public checkCallback(checking: boolean): boolean {
    return this.createCommandInvocation().invoke(checking);
  }

  /**
   * Creates a new command invocation.
   *
   * @returns The command invocation.
   */
  protected abstract createCommandInvocation(): CommandInvocationBase;
}
/* v8 ignore stop */
