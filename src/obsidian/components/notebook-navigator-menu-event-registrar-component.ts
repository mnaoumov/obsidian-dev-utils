/**
 * @file
 *
 * Bridges the file and files context-menu events into Notebook Navigator's own menus.
 *
 * Notebook Navigator draws its own file tree and never raises Obsidian's `file-menu` / `files-menu`
 * workspace events, so a plugin's context-menu items vanish for anyone browsing through it. This
 * component is a {@link MenuEventRegistrar} backed by Notebook Navigator's extension API instead of
 * the workspace, so the very same handlers reach both surfaces.
 */

import type {
  App,
  IconName,
  Menu,
  TAbstractFile,
  TFile
} from 'obsidian';

import { Menu as MenuImpl } from 'obsidian';

import type { DisposableEx } from '../../disposable.ts';
import type {
  EditorMenuEventHandler,
  FileMenuEventHandler,
  FilesMenuEventHandler,
  MarkdownViewportMenuEventHandler,
  MenuEventRegistrar
} from '../menu-event-registrar.ts';
import type {
  NotebookNavigatorFileMenuContext,
  NotebookNavigatorFolderMenuContext,
  NotebookNavigatorMenuContext
} from '../notebook-navigator.ts';

import { CallbackDisposable } from '../../disposable.ts';
import { noop } from '../../function.ts';
import {
  NOTEBOOK_NAVIGATOR_MENU_SOURCE,
  resolveNotebookNavigatorApi
} from '../notebook-navigator.ts';
import { LayoutReadyComponent } from './layout-ready-component.ts';

/**
 * Parameters for {@link NotebookNavigatorMenuEventRegistrarComponent}.
 */
export interface NotebookNavigatorMenuEventRegistrarComponentConstructorParams {
  /**
   * The application instance.
   */
  readonly app: App;

  /**
   * The plugin's display name, which titles the parent entry.
   */
  readonly pluginName: string;

  /**
   * The icon for the parent entry.
   *
   * @default `''` (no icon)
   */
  readonly submenuIcon?: IconName | undefined;
}

/**
 * {@link MenuEventRegistrar} backed by Notebook Navigator's menu-extension API.
 *
 * Handlers registered here are collected eagerly and bound to Notebook Navigator once the workspace
 * layout is ready. When Notebook Navigator is not installed the component simply stays dormant.
 *
 * Every collected handler writes into a plugin-titled parent entry's submenu, so a handler must NOT
 * declare a section submenu of its own — `Menu.sort()` would fold that into a second, nested
 * plugin-titled entry. `CommandHandlerComponent` takes care of this by forcing
 * `CommandHandlerRegistrationContext.shouldAddCommandToSubmenu` off for the surfaces it feeds here.
 */
export class NotebookNavigatorMenuEventRegistrarComponent extends LayoutReadyComponent implements MenuEventRegistrar {
  /**
   * The plugin's display name, which titles the parent entry.
   */
  protected readonly pluginName: string;

  /**
   * The icon for the parent entry.
   */
  protected readonly submenuIcon: IconName;

  private fileMenuEventHandlers: FileMenuEventHandler[] = [];
  private filesMenuEventHandlers: FilesMenuEventHandler[] = [];

  /**
   * Creates a new Notebook Navigator menu event registrar.
   *
   * @param params - The parameters for the component.
   */
  public constructor(params: NotebookNavigatorMenuEventRegistrarComponentConstructorParams) {
    super(params.app);
    this.pluginName = params.pluginName;
    this.submenuIcon = params.submenuIcon ?? '';
  }

  /**
   * Accepts an editor-menu registration and does nothing with it.
   *
   * Notebook Navigator extends the file tree, not the editor — an editor menu there is Obsidian's
   * own, which the handlers already reach through the workspace event. The registration is inert
   * rather than refused so a handler that declares one is not a load-time error.
   *
   * @param _handler - The handler, deliberately unused.
   * @returns A {@link DisposableEx} that has nothing to undo.
   */
  public registerEditorMenuEventHandler(_handler: EditorMenuEventHandler): DisposableEx {
    return new CallbackDisposable({ callback: noop });
  }

  /**
   * Collects a single-file menu handler.
   *
   * @param handler - The handler to collect.
   * @returns A {@link DisposableEx} that drops the handler again (or on component unload).
   */
  public registerFileMenuEventHandler(handler: FileMenuEventHandler): DisposableEx {
    this.fileMenuEventHandlers.push(handler);
    return this.registerDisposable(
      new CallbackDisposable({
        callback: (): void => {
          this.fileMenuEventHandlers = this.fileMenuEventHandlers.filter((collected) => collected !== handler);
        }
      })
    );
  }

  /**
   * Collects a multi-file menu handler.
   *
   * @param handler - The handler to collect.
   * @returns A {@link DisposableEx} that drops the handler again (or on component unload).
   */
  public registerFilesMenuEventHandler(handler: FilesMenuEventHandler): DisposableEx {
    this.filesMenuEventHandlers.push(handler);
    return this.registerDisposable(
      new CallbackDisposable({
        callback: (): void => {
          this.filesMenuEventHandlers = this.filesMenuEventHandlers.filter((collected) => collected !== handler);
        }
      })
    );
  }

  /**
   * Accepts a markdown-viewport-menu registration and does nothing with it.
   *
   * Notebook Navigator extends the file tree, not the editor — the margin beside a note's text is
   * Obsidian's own viewport, which the handlers already reach through the workspace event. The
   * registration is inert rather than refused so a handler that declares one is not a load-time error.
   *
   * @param _handler - The handler, deliberately unused.
   * @returns A {@link DisposableEx} that has nothing to undo.
   */
  public registerMarkdownViewportMenuEventHandler(_handler: MarkdownViewportMenuEventHandler): DisposableEx {
    return new CallbackDisposable({ callback: noop });
  }

  /**
   * Binds to Notebook Navigator once every plugin has loaded.
   *
   * Layout-ready rather than `onload`: plugin load order is not ours to choose, and Notebook
   * Navigator's API only exists once its own plugin is up. When it is not installed the component
   * stays dormant — enabling it later takes an Obsidian reload, exactly as it does for anything else
   * that reads another plugin at startup.
   */
  protected override onLayoutReady(): void {
    const api = resolveNotebookNavigatorApi(this.app);
    if (api === null) {
      return;
    }

    this.register(api.menus.registerFileMenu((context) => {
      this.handleFileMenu(context);
    }));
    this.register(api.menus.registerFolderMenu((context) => {
      this.handleFolderMenu(context);
    }));
  }

  /**
   * Adds the plugin's entry, unless the handlers had nothing to contribute.
   *
   * The menu is populated TWICE, and both runs are needed: Notebook Navigator's `addItem` cannot be
   * taken back once called, so the only way to keep an unrelated file's menu clean is to ask the
   * handlers first, against a menu nobody sees. The gates they answer with are metadata reads, so the
   * second run costs nothing and cannot disagree with the first.
   *
   * @param context - The Notebook Navigator menu being built.
   * @param populate - Runs the collected handlers against a menu.
   */
  private contribute(context: NotebookNavigatorMenuContext, populate: (menu: Menu) => void): void {
    const probeMenu = new MenuImpl();
    populate(probeMenu);

    if (probeMenu.items.length === 0) {
      return;
    }

    context.addItem((item) => {
      item
        .setTitle(this.pluginName)
        .setIcon(this.submenuIcon);
      populate(item.setSubmenu());
    });
  }

  /**
   * Handles a file menu, single or multi-selection.
   *
   * @param context - The Notebook Navigator menu being built.
   */
  private handleFileMenu(context: NotebookNavigatorFileMenuContext): void {
    const selectedFiles: TFile[] = [...context.selection.files];
    this.contribute(
      context,
      context.selection.mode === 'multiple'
        ? (menu: Menu): void => {
          this.runFilesMenuHandlers(menu, selectedFiles);
        }
        : (menu: Menu): void => {
          this.runFileMenuHandlers(menu, context.file);
        }
    );
  }

  /**
   * Handles a folder menu.
   *
   * A folder goes through the SINGLE-file handlers, because that is how Obsidian's own `file-menu`
   * carries one — the event is typed {@link TAbstractFile}, and the folder handlers are the ones that
   * narrow it.
   *
   * @param context - The Notebook Navigator menu being built.
   */
  private handleFolderMenu(context: NotebookNavigatorFolderMenuContext): void {
    this.contribute(context, (menu: Menu): void => {
      this.runFileMenuHandlers(menu, context.folder);
    });
  }

  /**
   * Runs the single-file handlers against a menu.
   *
   * @param menu - The menu to populate.
   * @param abstractFile - The file or folder the menu was raised on.
   */
  private runFileMenuHandlers(menu: Menu, abstractFile: TAbstractFile): void {
    for (const handler of this.fileMenuEventHandlers) {
      handler(menu, abstractFile, NOTEBOOK_NAVIGATOR_MENU_SOURCE);
    }
  }

  /**
   * Runs the multi-file handlers against a menu.
   *
   * @param menu - The menu to populate.
   * @param abstractFiles - The files the menu was raised on.
   */
  private runFilesMenuHandlers(menu: Menu, abstractFiles: TAbstractFile[]): void {
    for (const handler of this.filesMenuEventHandlers) {
      handler(menu, abstractFiles, NOTEBOOK_NAVIGATOR_MENU_SOURCE);
    }
  }
}
