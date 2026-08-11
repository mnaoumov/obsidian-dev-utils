/**
 * @file
 *
 * This module provides additional utilities for working with the Obsidian {@link Workspace}.
 */

import type {
  App,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `Workspace` to use it in the tsdocs.
  Workspace,
  WorkspaceContainer,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `WorkspaceWindow` to use it in the tsdocs.
  WorkspaceWindow
} from 'obsidian';

import type { DisposableEx } from '../disposable.ts';

import { CallbackDisposable } from '../disposable.ts';

/**
 * Waits until the workspace layout is ready.
 *
 * Resolves immediately when the layout is already ready; otherwise resolves once Obsidian fires the
 * layout-ready event.
 *
 * @param app - The Obsidian app.
 * @returns A {@link Promise} that resolves once the workspace layout is ready.
 */
export async function ensureLayoutReady(app: App): Promise<void> {
  await new Promise<void>((resolve) => {
    app.workspace.onLayoutReady(resolve);
  });
}

/**
 * Returns all containers in the workspace.
 *
 * @param app - The Obsidian app.
 * @returns All containers in the workspace.
 */
export function getAllContainers(app: App): WorkspaceContainer[] {
  const containers = new Set<WorkspaceContainer>();
  app.workspace.iterateAllLeaves((leaf) => {
    containers.add(leaf.getContainer());
  });
  return [...containers];
}

/**
 * Returns all DOM windows in the workspace.
 *
 * @param app - The Obsidian app.
 * @returns All DOM windows in the workspace.
 */
export function getAllDomWindows(app: App): Window[] {
  return getAllContainers(app).map((container) => container.win);
}

/**
 * Returns the app's main window — the one the vault opened in, as opposed to any popout window.
 *
 * Read from the root split, which is the one workspace container that always lives in the main window
 * (every popout is a {@link WorkspaceWindow} under `floatingSplit`). Prefer this over the global
 * `window`, which only happens to be the main window because plugin code runs in its context.
 *
 * @param app - The Obsidian app.
 * @returns The app's main window.
 */
export function getMainWindow(app: App): Window {
  return app.workspace.rootSplit.win;
}

/**
 * Makes the app's main window the active one until the returned {@link DisposableEx} is disposed.
 *
 * See {@link switchToWindow} for why this is needed and what it changes, and {@link getMainWindow} for
 * what counts as the main window.
 *
 * @param app - The Obsidian app.
 * @returns A {@link DisposableEx} that restores the previously active window when disposed.
 * @example
 * ```ts
 * // Raise a notice in the main window even while the settings window is open.
 * using _mainWindowSwitch = switchToMainWindow(app);
 * new Notice('This vault is a temporary sandbox.');
 * ```
 */
export function switchToMainWindow(app: App): DisposableEx {
  return switchToWindow(getMainWindow(app));
}

/**
 * Makes the given window the active one until the returned {@link DisposableEx} is disposed.
 *
 * Obsidian tracks the focused window in the `activeWindow` / `activeDocument` globals and updates them
 * whenever a window takes focus — including when a popout such as the settings window opens. UI it
 * creates for "the current window" reads those globals at creation time and offers no way to name a
 * window: `new Notice(...)`, for instance, is built inside whatever window `activeWindow` points at,
 * and cannot be moved afterwards. Pointing the globals at the wanted window for exactly that creation,
 * then putting them back, is what this does.
 *
 * Restore is what makes it safe, so always bind it with `using` (or dispose it in a `finally`): leaving
 * the globals pointed at the wrong window would misplace every later window-sensitive Obsidian call.
 *
 * @param win - The window to make active.
 * @returns A {@link DisposableEx} that restores the previously active window when disposed.
 * @example
 * ```ts
 * using _windowSwitch = switchToWindow(otherWindow);
 * new Notice('This notice belongs to the other window.');
 * ```
 */
export function switchToWindow(win: Window): DisposableEx {
  const previousActiveWindow = activeWindow;
  const previousActiveDocument = activeDocument;
  window.activeWindow = win;
  window.activeDocument = win.document;

  return new CallbackDisposable({
    callback: (): void => {
      window.activeWindow = previousActiveWindow;
      window.activeDocument = previousActiveDocument;
    }
  });
}
