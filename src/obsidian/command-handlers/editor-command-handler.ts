/**
 * @file
 *
 * Command handler for editor commands with optional editor menu integration.
 */

import type {
  Command,
  Editor,
  IconName,
  MarkdownFileInfo,
  Menu
} from 'obsidian';
import type { Promisable } from 'type-fest';

import type {
  CommandHandlerParams,
  CommandHandlerRegistrationContext
} from './command-handler.ts';

import { invokeAsyncSafely } from '../../async.ts';
import { CommandHandler } from './command-handler.ts';

/**
 * Parameters for creating an editor command handler.
 */
export interface EditorCommandHandlerParams extends CommandHandlerParams {
  /**
   * The item name to use in the editor menu.
   */
  readonly editorMenuItemName?: string | undefined;

  /**
   * The section to use in the editor menu.
   */
  readonly editorMenuSection?: string | undefined;

  /**
   * The icon to use in the editor menu submenu.
   */
  readonly editorMenuSubmenuIcon?: IconName | undefined;

  /**
   * Whether to add the command to a submenu.
   */
  readonly shouldAddCommandToSubmenu?: boolean | undefined;
}

/**
 * Command handler for editor commands.
 *
 * Subclasses override {@link canExecuteEditor} and {@link executeEditor} to provide behavior.
 * Optionally integrates with the editor context menu via {@link shouldAddToEditorMenu}.
 */
export abstract class EditorCommandHandler extends CommandHandler {
  /**
   * Gets the item name to use in the editor menu.
   *
   * @returns The item name, or `undefined` to use the command name.
   */
  protected get editorMenuItemName(): string | undefined {
    return this._editorMenuItemName;
  }

  /**
   * Gets the section to use in the editor menu.
   *
   * @returns The section name, or `undefined` to use the plugin name.
   */
  protected get editorMenuSection(): string | undefined {
    return this._editorMenuSection;
  }

  /**
   * Gets the icon to use in the editor menu submenu.
   *
   * @returns The icon, or `undefined` for no icon.
   */
  protected get editorMenuSubmenuIcon(): IconName | undefined {
    return this._editorMenuSubmenuIcon;
  }

  /**
   * Gets whether to add the command to a submenu.
   *
   * @returns Whether to add to a submenu.
   */
  protected get shouldAddCommandToSubmenu(): boolean | undefined {
    return this._shouldAddCommandToSubmenu;
  }

  private readonly _editorMenuItemName?: string | undefined;
  private readonly _editorMenuSection?: string | undefined;
  private readonly _editorMenuSubmenuIcon?: IconName | undefined;
  private readonly _shouldAddCommandToSubmenu?: boolean | undefined;

  /**
   * Creates a new editor command handler.
   *
   * @param params - The parameters for the editor command handler.
   */
  public constructor(params: EditorCommandHandlerParams) {
    super(params);
    this._editorMenuItemName = params.editorMenuItemName;
    this._editorMenuSection = params.editorMenuSection;
    this._editorMenuSubmenuIcon = params.editorMenuSubmenuIcon;
    this._shouldAddCommandToSubmenu = params.shouldAddCommandToSubmenu;
  }

  /**
   * Builds a plain Obsidian {@link Command} object with an `editorCheckCallback`.
   *
   * @returns A new {@link Command} object.
   */
  public override buildCommand(): Command {
    return {
      editorCheckCallback: (checking, editor, ctx) => this.editorCheckCallback(checking, editor, ctx),
      icon: this.icon,
      id: this.id,
      name: this.name
    };
  }

  /**
   * Registers the editor-menu event handler.
   *
   * @param context - The registration context.
   */
  public override async onRegistered(context: CommandHandlerRegistrationContext): Promise<void> {
    await super.onRegistered(context);
    context.menuEventRegistrar.registerEditorMenuEventHandler(this.handleEditorMenu.bind(this));
  }

  /**
   * Checks whether the command can execute for the given editor and context.
   *
   * @param _editor - The editor instance.
   * @param _ctx - The markdown file context.
   * @returns Whether the command can execute.
   */
  protected canExecuteEditor(_editor: Editor, _ctx: MarkdownFileInfo): boolean {
    return true;
  }

  /**
   * Executes the command for the given editor and context.
   *
   * @param editor - The editor instance.
   * @param ctx - The markdown file context.
   */
  protected abstract executeEditor(editor: Editor, ctx: MarkdownFileInfo): Promisable<void>;

  /**
   * Checks whether the command should appear in the command palette.
   *
   * @returns Whether to add to the command palette.
   */
  protected shouldAddToCommandPalette(): boolean {
    return true;
  }

  /**
   * Checks whether the command should appear in the editor context menu.
   *
   * @param _editor - The editor instance.
   * @param _ctx - The markdown file context.
   * @returns Whether to add to the editor menu.
   */
  protected shouldAddToEditorMenu(_editor: Editor, _ctx: MarkdownFileInfo): boolean {
    return false;
  }

  private editorCheckCallback(checking: boolean, editor: Editor, ctx: MarkdownFileInfo): boolean {
    if (!this.shouldAddToCommandPalette()) {
      return false;
    }

    if (!this.canExecuteEditor(editor, ctx)) {
      return false;
    }

    if (!checking) {
      invokeAsyncSafely(() => this.executeEditor(editor, ctx));
    }

    return true;
  }

  private handleEditorMenu(menu: Menu, editor: Editor, ctx: MarkdownFileInfo): void {
    if (!this.shouldAddToEditorMenu(editor, ctx)) {
      return;
    }

    if (!this.canExecuteEditor(editor, ctx)) {
      return;
    }

    const section = this.editorMenuSection ?? this.pluginName;
    if (this.shouldAddCommandToSubmenu) {
      menu.setSectionSubmenu(section, {
        icon: this.editorMenuSubmenuIcon ?? '',
        title: section
      });
    }

    menu.addItem((item) => {
      item
        .setTitle(this.editorMenuItemName ?? this.name)
        .setIcon(this.icon)
        .setSection(section)
        .onClick(() => {
          invokeAsyncSafely(() => this.executeEditor(editor, ctx));
        });
    });
  }
}
