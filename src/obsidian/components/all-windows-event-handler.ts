/**
 * @file
 *
 * Handles registering DOM events and handlers for all windows (main window and all existing/future popup windows) and their documents.
 */

import type {
  App,
  Component
} from 'obsidian';

import { getAllDomWindows } from '../workspace.ts';

/**
 * Handles registering DOM events and handlers for all windows (main window and all existing/future popup windows) and their documents.
 */
export class AllWindowsEventHandler {
  /**
   * Creates a new instance of the `AllWindowsEventHandler` class.
   *
   * @param app - The Obsidian app instance.
   * @param component - The component to register the event on.
   */
  public constructor(private readonly app: App, private readonly component: Component) {}

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
      this.component.registerDomEvent(win.document, type, callback, options);
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
      this.component.registerDomEvent(win, type, callback, options);
    });
  }

  /**
   * Registers a handler for all windows (main window and all existing/future popup windows).
   *
   * @param allWindowsHandler - The handler for all windows.
   */
  public registerAllWindowsHandler(allWindowsHandler: (win: Window) => void): void {
    const mainWindow = activeWindow;
    allWindowsHandler(mainWindow);

    this.app.workspace.onLayoutReady(() => {
      for (const win of getAllDomWindows(this.app)) {
        if (win === mainWindow) {
          continue;
        }

        allWindowsHandler(win);
      }

      this.component.registerEvent(this.app.workspace.on('window-open', (workspaceWindow) => {
        allWindowsHandler(workspaceWindow.win);
      }));
    });
  }
}
