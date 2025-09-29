/**
 * @packageDocumentation
 *
 * Base classes for non-editor commands.
 */

import type { Plugin } from 'obsidian';

import type { CommandInvocationBase } from './CommandBase.ts';

import { CommandBase } from './CommandBase.ts';

/**
 * Base class for non-editor commands.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class NonEditorCommandBase<TPlugin extends Plugin> extends CommandBase<TPlugin> {
  /**
   * Checks if the command can execute.
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
