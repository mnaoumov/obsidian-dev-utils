/**
 * @file
 *
 * Registers menu event handlers with Obsidian's workspace, supporting editor, file, and multi-file context menus.
 */

import type { App } from 'obsidian';

import type { DisposableEx } from '../../disposable.ts';
import type {
  EditorMenuEventHandler,
  FileMenuEventHandler,
  FilesMenuEventHandler,
  MenuEventRegistrar
} from '../menu-event-registrar.ts';

import { EventRefDisposable } from '../events.ts';
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
  public constructor(protected readonly app: App) {
    super();
  }

  /**
   * Registers a handler for the editor context menu event.
   *
   * @param handler - The handler to register.
   * @returns A {@link DisposableEx} that unregisters the handler when disposed (or on component unload).
   */
  public registerEditorMenuEventHandler(handler: EditorMenuEventHandler): DisposableEx {
    this.ensureLoaded();
    return this.registerDisposable(new EventRefDisposable(this.app.workspace.on('editor-menu', handler)));
  }

  /**
   * Registers a handler for the single-file context menu event.
   *
   * @param handler - The handler to register.
   * @returns A {@link DisposableEx} that unregisters the handler when disposed (or on component unload).
   */
  public registerFileMenuEventHandler(handler: FileMenuEventHandler): DisposableEx {
    this.ensureLoaded();
    return this.registerDisposable(new EventRefDisposable(this.app.workspace.on('file-menu', handler)));
  }

  /**
   * Registers a handler for the multi-file context menu event.
   *
   * @param handler - The handler to register.
   * @returns A {@link DisposableEx} that unregisters the handler when disposed (or on component unload).
   */
  public registerFilesMenuEventHandler(handler: FilesMenuEventHandler): DisposableEx {
    this.ensureLoaded();
    return this.registerDisposable(new EventRefDisposable(this.app.workspace.on('files-menu', handler)));
  }
}
