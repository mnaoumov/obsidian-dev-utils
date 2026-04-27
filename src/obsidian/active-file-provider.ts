/**
 * @file
 *
 * Provider for the currently active file.
 */

import type {
  App,
  TFile
} from 'obsidian';

/**
 * Provides access to the currently active file.
 */

/** */
export interface ActiveFileProvider {
  /**
   * Gets the currently active file.
   *
   * @returns The active file, or `null` if no file is active.
   */
  getActiveFile(): null | TFile;
}

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
