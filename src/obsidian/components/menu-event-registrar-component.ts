/**
 * @file
 *
 * Registers menu event handlers with Obsidian's workspace, supporting editor, file, and multi-file context menus.
 */

import type { App } from 'obsidian';

import type {
  EditorMenuEventHandler,
  FileMenuEventHandler,
  FilesMenuEventHandler,
  MenuEventRegistrar
} from '../menu-event-registrar.ts';

import { ComponentEx } from './component-ex.ts';

/**
 * {@link MenuEventRegistrar} backed by Obsidian's {@link App} workspace events.
 *
 * Event handlers are registered with the provided {@link Component} for lifecycle management.
 */
export class MenuEventRegistrarComponent extends ComponentEx implements MenuEventRegistrar {
  /**
   * Creates a new app-backed menu event registrar.
   *
   * @param app - The Obsidian app instance.
   */
  public constructor(private readonly app: App) {
    super();
  }

  /**
   * Registers a handler for the editor context menu event.
   *
   * @param handler - The handler to register.
   */
  public registerEditorMenuEventHandler(handler: EditorMenuEventHandler): void {
    this.registerEvent(this.app.workspace.on('editor-menu', handler));
  }

  /**
   * Registers a handler for the single-file context menu event.
   *
   * @param handler - The handler to register.
   */
  public registerFileMenuEventHandler(handler: FileMenuEventHandler): void {
    this.registerEvent(this.app.workspace.on('file-menu', handler));
  }

  /**
   * Registers a handler for the multi-file context menu event.
   *
   * @param handler - The handler to register.
   */
  public registerFilesMenuEventHandler(handler: FilesMenuEventHandler): void {
    this.registerEvent(this.app.workspace.on('files-menu', handler));
  }
}
