import type { Plugin } from 'obsidian';

import type { CommandInvocationBase } from './CommandBase.ts';

import { CommandBase } from './CommandBase.ts';

export abstract class NonEditorCommandBase<TPlugin extends Plugin> extends CommandBase<TPlugin> {
  public checkCallback(checking: boolean): boolean {
    return this.createCommandInvocation().invoke(checking);
  }

  protected abstract createCommandInvocation(): CommandInvocationBase;
}
