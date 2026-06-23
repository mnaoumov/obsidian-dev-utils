/**
 * @file
 *
 * Component that installs and maintains an opt-in O(1) case-insensitive file index for a vault.
 */

import type { App } from 'obsidian';

import {
  CaseInsensitiveFileIndex,
  setCaseInsensitiveFileIndex,
  unsetCaseInsensitiveFileIndex
} from '../case-insensitive-file-index.ts';
import { ComponentEx } from './component-ex.ts';

/**
 * Installs a {@link CaseInsensitiveFileIndex} for the vault while loaded and keeps it in sync with
 * `create`/`delete`/`rename` events. Once loaded, case-insensitive path resolution in
 * `obsidian-dev-utils` becomes O(1) even on a miss; on unload the index is removed and resolution
 * falls back to the native O(vault)-on-miss lookup.
 */
export class CaseInsensitiveFileIndexComponent extends ComponentEx {
  private readonly app: App;
  private readonly index: CaseInsensitiveFileIndex;

  /**
   * Creates a new case-insensitive file index component.
   *
   * @param app - The Obsidian application instance whose vault to index.
   */
  public constructor(app: App) {
    super();
    this.app = app;
    this.index = new CaseInsensitiveFileIndex(app);
  }

  /**
   * Builds the index from the currently-loaded files, installs it, and registers event handlers to
   * keep it in sync. Removes the index on unload.
   */
  public override onload(): void {
    for (const abstractFile of this.app.vault.getAllLoadedFiles()) {
      this.index.add(abstractFile);
    }

    setCaseInsensitiveFileIndex(this.index);
    this.register(() => {
      unsetCaseInsensitiveFileIndex(this.index);
    });

    this.registerEvent(this.app.vault.on('create', (file) => {
      this.index.add(file);
    }));
    this.registerEvent(this.app.vault.on('delete', (file) => {
      this.index.delete(file.path);
    }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      this.index.rename(oldPath, file);
    }));
  }
}
