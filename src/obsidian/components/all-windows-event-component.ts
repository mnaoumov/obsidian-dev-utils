/**
 * @file
 *
 * Handles registering DOM events and handlers for all windows (main window and all existing/future popup windows) and their documents.
 */

import type { App } from 'obsidian';

import { getAllDomWindows } from '../workspace.ts';
import { DisposableComponent } from './disposable-component.ts';

/**
 * Handles registering DOM events and handlers for all windows (main window and all existing/future popup windows) and their documents.
 */
export class AllWindowsEventComponent extends DisposableComponent {
  /**
   * Creates a new instance of the `AllWindowsEventComponent` class.
   *
   * @param app - The Obsidian app instance.
   */
  public constructor(private readonly app: App) {
    super();
  }

  /**
   * Registers a DOM event for all documents (main window document and all existing/future popup window documents).
   *
   * @typeParam DocumentEventType - The type of the event.
   * @param type - The type of the event.
   * @param callback - The callback to execute.
   * @param options - The options for the event.
   */
  public registerAllDocumentsDomEvent<DocumentEventType extends keyof DocumentEventMap>(
    type: DocumentEventType,
    callback: (this: HTMLElement, evt: DocumentEventMap[DocumentEventType]) => unknown,
    options?: AddEventListenerOptions | boolean
  ): void {
    this.registerAllWindowsHandler((win) => {
      this.registerDomEvent(win.document, type, callback, options);
    });
  }

  /**
   * Registers a DOM event for all windows (main window and all existing/future popup windows).
   *
   * @typeParam WindowEventType - The type of the event.
   * @param type - The type of the event.
   * @param callback - The callback to execute.
   * @param options - The options for the event.
   */
  public registerAllWindowsDomEvent<WindowEventType extends keyof WindowEventMap>(
    type: WindowEventType,
    callback: (this: HTMLElement, evt: WindowEventMap[WindowEventType]) => unknown,
    options?: AddEventListenerOptions | boolean
  ): void {
    this.registerAllWindowsHandler((win) => {
      this.registerDomEvent(win, type, callback, options);
    });
  }

  /**
   * Registers a handler for all windows (main window and all existing/future popup windows).
   *
   * @param allWindowsHandler - The handler called for each window (main + popups).
   */
  public registerAllWindowsHandler(allWindowsHandler: (win: Window) => void): void {
    const mainWindow = activeWindow;

    if (this._loaded) {
      allWindowsHandler(mainWindow);
    }

    this.app.workspace.onLayoutReady(() => {
      for (const win of getAllDomWindows(this.app)) {
        if (win === mainWindow) {
          continue;
        }

        if (this._loaded) {
          allWindowsHandler(win);
        }
      }

      this.registerEvent(this.app.workspace.on('window-open', (workspaceWindow) => {
        if (this._loaded) {
          allWindowsHandler(workspaceWindow.win);
        }
      }));
    });
  }
}
