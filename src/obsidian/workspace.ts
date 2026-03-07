/**
 * @packageDocumentation
 *
 * This module provides additional utilities for working with the Obsidian {@link Workspace}.
 */

import type {
  App,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `Workspace` to use it in the tsdocs.
  Workspace,
  WorkspaceContainer
} from 'obsidian';

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
  return Array.from(containers);
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
