/**
 * @packageDocumentation
 *
 * Base classes for editor commands.
 */

import type {
  Editor,
  MarkdownFileInfo,
  MarkdownView,
  Menu,
  Plugin,
  TFile
} from 'obsidian';

import {
  CommandBase,
  CommandInvocationBase
} from './CommandBase.ts';

/**
 * Base class for editor commands.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class EditorCommandBase<TPlugin extends Plugin> extends CommandBase<TPlugin> {
  protected readonly menuItemName?: string;
  protected readonly menuSection?: string;

  /**
   * Checks if the command can execute.
   *
   * @param checking - Is checking mode only. If `true`, only the check if the command can execute is performed. If `false`, the command is executed.
   * @param editor - The editor to check.
   * @param ctx - The context of the command.
   * @returns Whether the command can execute.
   */
  public editorCheckCallback(checking: boolean, editor: Editor, ctx: MarkdownFileInfo | MarkdownView): boolean {
    return this.createEditorCommandInvocation(editor, ctx).invoke(checking);
  }

  /**
   * Registers the command.
   */
  public override register(): void {
    super.register();
    this.plugin.registerEvent(this.app.workspace.on('editor-menu', this.handleEditorMenu.bind(this)));
  }

  /**
   * Creates a new editor command invocation.
   *
   * @param editor - The editor to create the command invocation for.
   * @param ctx - The context of the command.
   * @returns The command invocation.
   */
  protected abstract createEditorCommandInvocation(editor: Editor, ctx: MarkdownFileInfo | MarkdownView): CommandInvocationBase;

  /**
   * Checks if the command should be added to the editor menu.
   *
   * @param _editor - The editor to check.
   * @param _ctx - The context of the command.
   * @returns Whether the command should be added to the editor menu.
   */
  protected shouldAddToEditorMenu(_editor: Editor, _ctx: MarkdownFileInfo | MarkdownView): boolean {
    return false;
  }

  private handleEditorMenu(menu: Menu, editor: Editor, ctx: MarkdownFileInfo | MarkdownView): void {
    if (!this.createEditorCommandInvocation(editor, ctx).invoke(true)) {
      return;
    }

    if (!this.shouldAddToEditorMenu(editor, ctx)) {
      return;
    }

    menu.addItem((item) => {
      item
        .setTitle(this.menuItemName ?? this.name)
        .setIcon(this.icon)
        .setSection(this.menuSection ?? '')
        .onClick(() => this.createEditorCommandInvocation(editor, ctx).invoke(false));
    });
  }
}

/**
 * Base class for editor command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export class EditorCommandInvocationBase<TPlugin extends Plugin> extends CommandInvocationBase<TPlugin> {
  protected activeFile!: TFile;

  /**
   * Creates a new editor command invocation.
   *
   * @param plugin - The plugin that the command invocation belongs to.
   * @param editor - The editor to create the command invocation for.
   * @param ctx - The context of the command.
   */
  public constructor(plugin: TPlugin, protected readonly editor: Editor, protected readonly ctx: MarkdownFileInfo | MarkdownView) {
    super(plugin);
  }

  /**
   * Checks if the command can execute.
   *
   * @returns Whether the command can execute.
   */
  public override canExecute(): boolean {
    if (!super.canExecute()) {
      return false;
    }

    if (!this.ctx.file) {
      return false;
    }

    this.activeFile = this.ctx.file;
    return true;
  }
}
