/**
 * @file
 *
 * App-backed implementation of {@link ActiveFileProvider}.
 */

import type {
  App,
  TFile
} from 'obsidian';

import type { ActiveFileProvider } from './command-handler.ts';

/**
 * {@link ActiveFileProvider} backed by Obsidian's {@link App}.
 */
export class AppActiveFileProvider implements ActiveFileProvider {
  /**
   * Creates a new app-backed active file provider.
   *
   * @param app - The Obsidian app instance.
   */
  public constructor(private readonly app: App) {}

  /**
   * Gets the currently active file from the workspace.
   *
   * @returns The active file, or `null` if no file is active.
   */
  public getActiveFile(): null | TFile {
    return this.app.workspace.getActiveFile();
  }
}
