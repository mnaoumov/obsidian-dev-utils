/**
 * @file
 *
 * Provides an opt-in O(1) case-insensitive resolver for Obsidian vaults.
 *
 * Obsidian's native {@link https://docs.obsidian.md/Reference/TypeScript+API/Vault | Vault} resolves
 * a string path case-insensitively (the Windows/macOS default) in O(1) on a hit but with an
 * O(vault) scan on a miss. The miss case is the hot one during deletion cascades, where extension
 * checks and cache lookups are performed on already-removed paths. This module backs the
 * case-insensitive lookup with a `lowercase-path → TAbstractFile` index so misses are O(1) too.
 *
 * The index is explicitly opt-in: a consumer installs it by loading a
 * {@link https://docs.obsidian.md/Reference/TypeScript+API/Component | Component} that keeps it in
 * sync with `create`/`delete`/`rename` events (see `CaseInsensitiveFileIndexComponent`). Until then,
 * the resolution layer falls back to the native (O(vault)-on-miss) lookup, so behavior is unchanged.
 */

import type {
  App,
  TAbstractFile
} from 'obsidian';

import { getObsidianDevUtilsState } from '../obsidian-dev-utils-state.ts';

const STATE_KEY = 'caseInsensitiveFileIndex';

/**
 * An O(1) case-insensitive index of the loaded files and folders of a single vault.
 *
 * The index maps the lowercased path of each abstract file to the abstract file itself. It is kept
 * in sync by an owning component that forwards `create`/`delete`/`rename` vault events.
 */
export class CaseInsensitiveFileIndex {
  private readonly map = new Map<string, TAbstractFile>();

  /**
   * Creates a new case-insensitive file index.
   *
   * @param app - The Obsidian application instance whose vault this index mirrors.
   */
  public constructor(protected readonly app: App) {
  }

  /**
   * Adds an abstract file to the index.
   *
   * @param abstractFile - The abstract file to add.
   */
  public add(abstractFile: TAbstractFile): void {
    this.map.set(abstractFile.path.toLowerCase(), abstractFile);
  }

  /**
   * Removes the abstract file at the given path from the index, along with all of its descendants
   * (for folder deletions, where Obsidian removes the whole subtree).
   *
   * @param path - The path of the abstract file to remove.
   */
  public delete(path: string): void {
    const key = path.toLowerCase();
    this.map.delete(key);
    const descendantPrefix = `${key}/`;
    for (const existingKey of Array.from(this.map.keys())) {
      if (existingKey.startsWith(descendantPrefix)) {
        this.map.delete(existingKey);
      }
    }
  }

  /**
   * Resolves an abstract file by its path, case-insensitively, in O(1).
   *
   * @param path - The path to resolve.
   * @returns The abstract file if found, otherwise `null`.
   */
  public get(path: string): null | TAbstractFile {
    return this.map.get(path.toLowerCase()) ?? null;
  }

  /**
   * Checks whether this index mirrors the given application's vault.
   *
   * @param app - The application instance to check against.
   * @returns `true` if this index belongs to the given application, `false` otherwise.
   */
  public ownsApp(app: App): boolean {
    return this.app === app;
  }

  /**
   * Re-keys an abstract file (and, for folders, all of its descendants) after a rename.
   *
   * Obsidian fires a single `rename` event for the renamed abstract file and updates its
   * descendants' paths in place without firing per-descendant events, so descendant keys are
   * recomputed here by swapping the old path prefix for the new one. Handles case-only renames (the
   * old and new keys coincide).
   *
   * @param oldPath - The path the abstract file had before the rename.
   * @param newAbstractFile - The abstract file with its updated (post-rename) path.
   */
  public rename(oldPath: string, newAbstractFile: TAbstractFile): void {
    const oldKey = oldPath.toLowerCase();
    const newKey = newAbstractFile.path.toLowerCase();
    this.map.delete(oldKey);
    this.map.set(newKey, newAbstractFile);

    const oldDescendantPrefix = `${oldKey}/`;
    const newDescendantPrefix = `${newKey}/`;
    for (const [existingKey, existingValue] of Array.from(this.map.entries())) {
      if (existingKey.startsWith(oldDescendantPrefix)) {
        this.map.delete(existingKey);
        this.map.set(newDescendantPrefix + existingKey.slice(oldDescendantPrefix.length), existingValue);
      }
    }
  }
}

/**
 * Retrieves the installed case-insensitive file index for the given application, if any.
 *
 * @param app - The application instance whose index to retrieve.
 * @returns The index if one is installed for this application, otherwise `null`.
 */
export function getCaseInsensitiveFileIndex(app: App): CaseInsensitiveFileIndex | null {
  const index = getObsidianDevUtilsState<CaseInsensitiveFileIndex | null>(STATE_KEY, null).value;
  if (index?.ownsApp(app)) {
    return index;
  }
  return null;
}

/**
 * Installs a case-insensitive file index as the active resolver.
 *
 * @param index - The index to install.
 */
export function setCaseInsensitiveFileIndex(index: CaseInsensitiveFileIndex): void {
  getObsidianDevUtilsState<CaseInsensitiveFileIndex | null>(STATE_KEY, null).value = index;
}

/**
 * Uninstalls a case-insensitive file index, but only if it is the currently-installed one.
 *
 * @param index - The index to uninstall.
 */
export function unsetCaseInsensitiveFileIndex(index: CaseInsensitiveFileIndex): void {
  const wrapper = getObsidianDevUtilsState<CaseInsensitiveFileIndex | null>(STATE_KEY, null);
  if (wrapper.value === index) {
    wrapper.value = null;
  }
}
