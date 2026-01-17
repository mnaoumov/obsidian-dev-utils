/**
 * @packageDocumentation
 *
 * Base classes for editor commands.
 */

import type {
  Editor,
  IconName,
  MarkdownFileInfo,
  Menu,
  Plugin,
  TFile
} from 'obsidian';

import type { CommandBaseOptions } from './CommandBase.ts';

import {
  CommandBase,
  CommandInvocationBase
} from './CommandBase.ts';

/**
 * Options for creating an editor command.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export interface EditorCommandBaseOptions<TPlugin extends Plugin> extends CommandBaseOptions<TPlugin> {
  /**
   * The item name to use in the editor menu.
   */
  editorMenuItemName?: string | undefined;

  /**
   * The section to use in the editor menu.
   */
  editorMenuSection?: string | undefined;

  /**
   * The icon to use in the editor menu submenu.
   */
  editorMenuSubmenuIcon?: IconName | undefined;

  /**
   * Whether to add the command to the submenu.
   */
  shouldAddCommandToSubmenu?: boolean | undefined;
}

/**
 * Base class for editor commands.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class EditorCommandBase<TPlugin extends Plugin> extends CommandBase<TPlugin> {
  /**
   * Gets the item name to use in the editor menu.
   *
   * @returns The item name to use in the editor menu.
   */
  protected get editorMenuItemName(): string | undefined {
    return this._editorMenuItemName;
  }

  /**
   * Gets the section to use in the editor menu.
   *
   * @returns The section to use in the editor menu.
   */
  protected get editorMenuSection(): string | undefined {
    return this._editorMenuSection;
  }

  /**
   * Gets the icon to use in the editor menu submenu.
   *
   * @returns The icon to use in the editor menu submenu.
   */
  protected get editorMenuSubmenuIcon(): IconName | undefined {
    return this._editorMenuSubmenuIcon;
  }

  /**
   * Gets whether to add the command to the submenu.
   *
   * @returns Whether to add the command to the submenu.
   */
  protected get shouldAddCommandToSubmenu(): boolean | undefined {
    return this._shouldAddCommandToSubmenu;
  }

  private readonly _editorMenuItemName?: string | undefined;
  private readonly _editorMenuSection?: string | undefined;
  private readonly _editorMenuSubmenuIcon?: IconName | undefined;
  private readonly _shouldAddCommandToSubmenu?: boolean | undefined;

  /**
   * Creates a new editor command.
   *
   * @param options - The options for the editor command.
   */
  public constructor(options: EditorCommandBaseOptions<TPlugin>) {
    super(options);
    this._editorMenuItemName = options.editorMenuItemName;
    this._editorMenuSection = options.editorMenuSection;
    this._editorMenuSubmenuIcon = options.editorMenuSubmenuIcon;
    this._shouldAddCommandToSubmenu = options.shouldAddCommandToSubmenu;
  }

  /**
   * Checks if the command can execute or executes it.
   *
   * @param checking - Is checking mode only. If `true`, only the check if the command can execute is performed. If `false`, the command is executed.
   * @param editor - The editor to check.
   * @param ctx - The context of the command.
   * @returns Whether the command can execute.
   */
  public editorCheckCallback(checking: boolean, editor: Editor, ctx: MarkdownFileInfo): boolean {
    if (!this.shouldAddToCommandPalette()) {
      return false;
    }
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
  protected abstract createEditorCommandInvocation(editor: Editor, ctx: MarkdownFileInfo): CommandInvocationBase;

  /**
   * Checks if the command should be added to the command palette.
   *
   * @returns Whether the command should be added to the command palette.
   */
  protected shouldAddToCommandPalette(): boolean {
    return true;
  }

  /**
   * Checks if the command should be added to the editor menu.
   *
   * @param _editor - The editor to check.
   * @param _ctx - The context of the command.
   * @returns Whether the command should be added to the editor menu.
   */
  protected shouldAddToEditorMenu(_editor: Editor, _ctx: MarkdownFileInfo): boolean {
    return false;
  }

  private handleEditorMenu(menu: Menu, editor: Editor, ctx: MarkdownFileInfo): void {
    if (!this.shouldAddToEditorMenu(editor, ctx)) {
      return;
    }

    if (!this.createEditorCommandInvocation(editor, ctx).invoke(true)) {
      return;
    }

    const editorMenuSection = this.editorMenuSection ?? this.plugin.manifest.name;
    if (this.shouldAddCommandToSubmenu) {
      menu.setSectionSubmenu(editorMenuSection, {
        icon: this.editorMenuSubmenuIcon ?? '',
        title: editorMenuSection
      });
    }

    menu.addItem((item) => {
      item
        .setTitle(this.editorMenuItemName ?? this.originalName)
        .setIcon(this.icon)
        .setSection(editorMenuSection)
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
  /**
   * The file to invoke the command for.
   *
   * @returns The file to invoke the command for.
   * @throws If the file is not set.
   */
  protected get file(): TFile {
    if (!this._file) {
      throw new Error('File not set');
    }
    return this._file;
  }

  private readonly _file: null | TFile;

  /**
   * Creates a new editor command invocation.
   *
   * @param plugin - The plugin that the command invocation belongs to.
   * @param editor - The editor to create the command invocation for.
   * @param ctx - The context of the command.
   */
  public constructor(plugin: TPlugin, protected readonly editor: Editor, protected readonly ctx: MarkdownFileInfo) {
    super(plugin);
    this._file = ctx.file;
  }

  /**
   * Checks if the command can execute.
   *
   * @returns Whether the command can execute.
   */
  public override canExecute(): boolean {
    return super.canExecute() && !!this._file;
  }
}
