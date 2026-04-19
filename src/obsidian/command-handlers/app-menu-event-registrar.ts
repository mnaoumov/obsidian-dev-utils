/**
 * @file
 *
 * App-backed implementation of {@link MenuEventRegistrar}.
 */

import type {
  App,
  Component
} from 'obsidian';

import type {
  EditorMenuEventHandler,
  FileMenuEventHandler,
  FilesMenuEventHandler,
  MenuEventRegistrar
} from './command-handler.ts';

/**
 * {@link MenuEventRegistrar} backed by Obsidian's {@link App} workspace events.
 *
 * Event handlers are registered with the provided {@link Component} for lifecycle management.
 */
export class AppMenuEventRegistrar implements MenuEventRegistrar {
  /**
   * Creates a new app-backed menu event registrar.
   *
   * @param app - The Obsidian app instance.
   * @param component - The component for lifecycle management.
   */
  public constructor(
    private readonly app: App,
    private readonly component: Component
  ) {}

  /**
   * Registers a handler for the editor context menu event.
   *
   * @param handler - The handler to register.
   */
  public registerEditorMenuEventHandler(handler: EditorMenuEventHandler): void {
    this.component.registerEvent(this.app.workspace.on('editor-menu', handler));
  }

  /**
   * Registers a handler for the single-file context menu event.
   *
   * @param handler - The handler to register.
   */
  public registerFileMenuEventHandler(handler: FileMenuEventHandler): void {
    this.component.registerEvent(this.app.workspace.on('file-menu', handler));
  }

  /**
   * Registers a handler for the multi-file context menu event.
   *
   * @param handler - The handler to register.
   */
  public registerFilesMenuEventHandler(handler: FilesMenuEventHandler): void {
    this.component.registerEvent(this.app.workspace.on('files-menu', handler));
  }
}
