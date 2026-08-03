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
  CommandHandlerConstructorParams,
  CommandHandlerRegistrationContext
} from './command-handler.ts';

import {
  convertAsyncToSync,
  invokeAsyncSafely
} from '../../async.ts';
import { CommandHandler } from './command-handler.ts';

/**
 * Parameters for creating an editor command handler.
 */
export interface EditorCommandHandlerConstructorParams extends CommandHandlerConstructorParams {
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
   *
   * @default `false`
   */
  readonly shouldAddCommandToSubmenu?: boolean | undefined;
}

/**
 * Parameters for {@link EditorCommandHandler.editorCheckCallback}.
 */
export interface EditorCommandHandlerEditorCheckCallbackParams {
  /**
   * Whether Obsidian is only checking availability (not executing).
   */
  readonly checking: boolean;

  /**
   * The markdown file context.
   */
  readonly context: MarkdownFileInfo;

  /**
   * The editor instance.
   */
  readonly editor: Editor;
}

/**
 * Parameters for {@link EditorCommandHandler.handleEditorMenu}.
 */
export interface EditorCommandHandlerHandleEditorMenuParams {
  /**
   * The markdown file context.
   */
  readonly context: MarkdownFileInfo;

  /**
   * The editor instance.
   */
  readonly editor: Editor;

  /**
   * The menu to add items to.
   */
  readonly menu: Menu;
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

  private readonly _editorMenuItemName?: string | undefined;

  private readonly _editorMenuSection?: string | undefined;
  private readonly _editorMenuSubmenuIcon?: IconName | undefined;
  private readonly _shouldAddCommandToSubmenu?: boolean | undefined;

  /**
   * Creates a new editor command handler.
   *
   * @param params - The parameters for the editor command handler.
   */
  public constructor(params: EditorCommandHandlerConstructorParams) {
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
      editorCheckCallback: (checking, editor, context) =>
        this.editorCheckCallback({
          checking,
          context,
          editor
        }),
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
    context.menuEventRegistrar.registerEditorMenuEventHandler((menu, editor, $context) => {
      this.handleEditorMenu({
        context: $context,
        editor,
        menu
      });
    });
  }

  /**
   * Checks whether the command can execute for the given editor and context.
   *
   * @param _editor - The editor instance.
   * @param _context - The markdown file context.
   * @returns Whether the command can execute.
   */
  protected canExecuteEditor(_editor: Editor, _context: MarkdownFileInfo): boolean {
    return true;
  }

  /**
   * Executes the command for the given editor and context.
   *
   * @param editor - The editor instance.
   * @param context - The markdown file context.
   */
  protected abstract executeEditor(editor: Editor, context: MarkdownFileInfo): Promisable<void>;

  /**
   * Gets whether to add the command to a submenu.
   *
   * @returns Whether to add to a submenu.
   */
  protected shouldAddCommandToSubmenu(): boolean | undefined {
    return this._shouldAddCommandToSubmenu;
  }

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
   * @param _context - The markdown file context.
   * @returns Whether to add to the editor menu.
   */
  protected shouldAddToEditorMenu(_editor: Editor, _context: MarkdownFileInfo): boolean {
    return false;
  }

  private editorCheckCallback(params: EditorCommandHandlerEditorCheckCallbackParams): boolean {
    const {
      checking,
      context,
      editor
    } = params;
    if (!this.shouldAddToCommandPalette()) {
      return false;
    }

    if (!this.canExecuteEditor(editor, context)) {
      return false;
    }

    if (!checking) {
      invokeAsyncSafely(() => this.executeEditor(editor, context));
    }

    return true;
  }

  private handleEditorMenu(params: EditorCommandHandlerHandleEditorMenuParams): void {
    const {
      context,
      editor,
      menu
    } = params;
    if (!this.shouldAddToEditorMenu(editor, context)) {
      return;
    }

    if (!this.canExecuteEditor(editor, context)) {
      return;
    }

    const section = this.editorMenuSection ?? this.pluginName;
    if (this.shouldAddCommandToSubmenu()) {
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
        .onClick(convertAsyncToSync(async () => this.executeEditor(editor, context)));
    });
  }
}
