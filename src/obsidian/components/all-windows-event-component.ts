/**
 * @file
 *
 * Handles registering DOM events and handlers for all windows (main window and all existing/future popup windows) and their documents.
 */

import type { App } from 'obsidian';

import { getAllDomWindows } from '../workspace.ts';
import { ComponentEx } from './component-ex.ts';
import { CallbackLayoutReadyComponent } from './layout-ready-component.ts';

/**
 * Parameters for {@link AllWindowsEventComponent.registerAllDocumentsDomEvent}.
 *
 * @typeParam DocumentEventType - The type of the event.
 */
export interface AllWindowsEventComponentRegisterAllDocumentsDomEventParams<DocumentEventType extends keyof DocumentEventMap> {
  /**
   * The callback to execute.
   *
   * @param evt - The event.
   * @returns The result of the callback.
   */
  callback(this: HTMLElement, evt: DocumentEventMap[DocumentEventType]): unknown;

  /**
   * The options for the event.
   */
  readonly options?: AddEventListenerOptions | boolean;

  /**
   * The type of the event.
   */
  readonly type: DocumentEventType;
}

/**
 * Parameters for {@link AllWindowsEventComponent.registerAllWindowsDomEvent}.
 *
 * @typeParam WindowEventType - The type of the event.
 */
export interface AllWindowsEventComponentRegisterAllWindowsDomEventParams<WindowEventType extends keyof WindowEventMap> {
  /**
   * The callback to execute.
   *
   * @param evt - The event.
   * @returns The result of the callback.
   */
  callback(this: HTMLElement, evt: WindowEventMap[WindowEventType]): unknown;

  /**
   * The options for the event.
   */
  readonly options?: AddEventListenerOptions | boolean;

  /**
   * The type of the event.
   */
  readonly type: WindowEventType;
}

/**
 * Handles registering DOM events and handlers for all windows (main window and all existing/future popup windows) and their documents.
 */
export class AllWindowsEventComponent extends ComponentEx {
  /**
   * Creates a new instance of the `AllWindowsEventComponent` class.
   *
   * @param app - The Obsidian app instance.
   */
  public constructor(protected readonly app: App) {
    super();
  }

  /**
   * Registers a DOM event for all documents (main window document and all existing/future popup window documents).
   *
   * @typeParam DocumentEventType - The type of the event.
   * @param params - The parameters for registering the DOM event.
   */
  public registerAllDocumentsDomEvent<DocumentEventType extends keyof DocumentEventMap>(
    params: AllWindowsEventComponentRegisterAllDocumentsDomEventParams<DocumentEventType>
  ): void {
    const {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- The callback is a DOM event handler forwarded to registerDomEvent, which binds this to the element.
      callback,
      options,
      type
    } = params;
    this.ensureLoaded();

    this.registerAllWindowsHandler((win) => {
      this.registerDomEvent(win.document, type, callback, options);
    });
  }

  /**
   * Registers a DOM event for all windows (main window and all existing/future popup windows).
   *
   * @typeParam WindowEventType - The type of the event.
   * @param params - The parameters for registering the DOM event.
   */
  public registerAllWindowsDomEvent<WindowEventType extends keyof WindowEventMap>(
    params: AllWindowsEventComponentRegisterAllWindowsDomEventParams<WindowEventType>
  ): void {
    const {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- The callback is a DOM event handler forwarded to registerDomEvent, which binds this to the element.
      callback,
      options,
      type
    } = params;
    this.ensureLoaded();

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
    this.ensureLoaded();

    const mainWindow = activeWindow;
    allWindowsHandler(mainWindow);

    this.addChild(
      new CallbackLayoutReadyComponent(this.app, () => {
        for (const win of getAllDomWindows(this.app)) {
          if (win === mainWindow) {
            continue;
          }

          allWindowsHandler(win);
        }

        this.registerEvent(this.app.workspace.on('window-open', (workspaceWindow) => {
          allWindowsHandler(workspaceWindow.win);
        }));
      })
    );
  }
}
