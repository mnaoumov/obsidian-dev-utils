/**
 * @file
 *
 * A reversible, transactional log of vault mutations. Each mutation records how to undo itself;
 * {@link VaultTransaction.rollback} reverses the completed steps in reverse order and
 * {@link VaultTransaction.commit} finalizes them. It is built on the `*Safe` vault wrappers so it
 * inherits their case-insensitive / retry / missing-file handling.
 *
 * A deletion is performed as a **soft-delete**: the resource is moved aside into a dot-prefixed
 * staging folder (a folder moves its whole subtree in a single rename, so subtree rollback is cheap
 * and faithful). Because Obsidian's vault file-tree and file watcher ignore any `.`-prefixed path,
 * staged resources are **untracked** — they do not churn the metadata cache, flash in the file
 * explorer, or get propagated by sync while the transaction is in flight. The flip side is that
 * `vault.*` methods cannot see the staging area, so ALL staging I/O goes through
 * {@link App.vault.adapter} (`mkdir`/`rename`/`exists`/`trashSystem`/`rmdir`).
 * {@link VaultTransaction.commit} then trashes the staged resources for real; {@link VaultTransaction.rollback}
 * moves them back.
 */

import type {
  App,
  TFile
} from 'obsidian';

import type { PathOrAbstractFile } from './file-system.ts';

import { assertNonNullable } from '../type-guards.ts';
import {
  getAbstractFileOrNull,
  getPath
} from './file-system.ts';
import {
  createFolderSafe,
  process,
  readSafe,
  renameSafe
} from './vault.ts';

const DEFAULT_STAGING_FOLDER_PATH = '.obsidian-dev-utils-temp';

/**
 * Parameters for the {@link VaultTransaction} constructor.
 */
export interface VaultTransactionConstructorParams {
  /**
   * The Obsidian application instance.
   */
  readonly app: App;

  /**
   * Opens an ambient mutation-bypass scope covering the paths this transaction touches, so the
   * transaction's own writes pass a `shouldBlockMutations` lock that the owning operation holds. It is
   * called once when the transaction is constructed, and the returned {@link Disposable} is disposed
   * when the transaction settles (on `commit`, `rollback`, or `await using` disposal) — so the bypass
   * stays active through rollback, including auto-rollback, which a caller managing the scope itself
   * could easily get wrong. Typically
   * `() => resourceLockComponent.bypassBlockedMutations(lockedPathsOrFiles)`. Omit it for the common
   * standalone case where the transaction operates on unlocked paths.
   *
   * @returns A {@link Disposable} that ends the bypass scope.
   */
  openMutationBypass?(this: void): Disposable;

  /**
   * The dot-prefixed folder that soft-deleted resources are moved into until the transaction is
   * committed or rolled back. It must stay `.`-prefixed so Obsidian leaves the staged resources
   * untracked.
   *
   * @default `'.obsidian-dev-utils-temp'`
   */
  readonly stagingFolderPath?: string;
}

type TransactionState = 'committed' | 'open' | 'rolledBack';

interface UndoStep {
  undo(this: void): Promise<void>;
}

/**
 * A reversible log of vault mutations. Perform mutations through its methods, then call
 * {@link VaultTransaction.commit} on success or {@link VaultTransaction.rollback} on failure. It is
 * `await using`-friendly: if neither is called, disposal rolls back.
 */
export class VaultTransaction {
  private readonly app: App;
  private hasStagingFolder = false;
  private mutationBypass: Disposable | null = null;
  private readonly stagedTrashPaths: string[] = [];
  private readonly stagingFolderPath: string;
  private state: TransactionState = 'open';
  private readonly undoSteps: UndoStep[] = [];

  /**
   * Creates a new vault transaction.
   *
   * @param params - The parameters.
   */
  public constructor(params: VaultTransactionConstructorParams) {
    this.app = params.app;
    this.stagingFolderPath = params.stagingFolderPath ?? DEFAULT_STAGING_FOLDER_PATH;
    this.mutationBypass = params.openMutationBypass?.() ?? null;
  }

  /**
   * Commits the transaction: finalizes soft-deletes by trashing the staged resources for real and
   * removes the staging folder. After this the transaction can no longer be mutated or rolled back.
   *
   * @returns A {@link Promise} that resolves when the commit completes.
   */
  public async commit(): Promise<void> {
    this.assertOpen();
    this.state = 'committed';
    const adapter = this.app.vault.adapter;
    for (const stagedPath of this.stagedTrashPaths) {
      const wasTrashedToSystem = await adapter.trashSystem(stagedPath);
      if (!wasTrashedToSystem) {
        await adapter.trashLocal(stagedPath);
      }
    }
    await this.removeStagingFolder();
    this.disposeMutationBypass();
  }

  /**
   * Creates a file with the given content, recording its removal as the inverse.
   *
   * @param path - The path of the file to create.
   * @param data - The content of the file.
   * @returns A {@link Promise} resolving to the created {@link TFile}.
   */
  public async create(path: string, data: string): Promise<TFile> {
    this.assertOpen();
    const file = await this.app.vault.create(path, data);
    const createdPath = file.path;
    this.pushUndo(async () => {
      await this.hardDelete(createdPath);
    });
    return file;
  }

  /**
   * Creates a folder (including missing ancestors), recording its removal as the inverse. A no-op if
   * the folder already exists.
   *
   * @param path - The path of the folder to create.
   * @returns A {@link Promise} that resolves when the folder exists.
   */
  public async createFolder(path: string): Promise<void> {
    this.assertOpen();
    const wasCreated = await createFolderSafe(this.app, path);
    if (wasCreated) {
      this.pushUndo(async () => {
        await this.hardDelete(path);
      });
    }
  }

  /**
   * Replaces the content of a file, capturing the old content so it can be restored on rollback.
   *
   * @param pathOrFile - The path or file to modify.
   * @param newContent - The new content.
   * @returns A {@link Promise} that resolves when the file is modified.
   */
  public async modify(pathOrFile: PathOrAbstractFile, newContent: string): Promise<void> {
    await this.process(pathOrFile, () => newContent);
  }

  /**
   * Transforms the content of a file, capturing the old content so it can be restored on rollback.
   *
   * @param pathOrFile - The path or file to process.
   * @param newContentProvider - Maps the current content to the new content.
   * @returns A {@link Promise} that resolves when the file is processed.
   */
  public async process(pathOrFile: PathOrAbstractFile, newContentProvider: (content: string) => string): Promise<void> {
    this.assertOpen();
    const path = getPath(this.app, pathOrFile);
    const oldContent = await readSafe(this.app, path);
    await process({
      app: this.app,
      newContentProvider: ({ content }) => newContentProvider(content),
      pathOrFile: path,
      resourceLockComponent: null
    });
    // Reaching this line means `process` succeeded. A missing file would have thrown above (its
    // `shouldFailOnMissingFile` default), so the pre-image was captured and can be restored on rollback.
    assertNonNullable(oldContent);
    this.pushUndo(async () => {
      await process({
        app: this.app,
        newContentProvider: oldContent,
        pathOrFile: path,
        resourceLockComponent: null
      });
    });
  }

  /**
   * Renames or moves a resource, recording the reverse rename as the inverse.
   *
   * @param oldPathOrFile - The resource to rename.
   * @param newPath - The desired new path (an available path is chosen if it is taken).
   * @returns A {@link Promise} resolving to the actual new path.
   */
  public async rename(oldPathOrFile: PathOrAbstractFile, newPath: string): Promise<string> {
    this.assertOpen();
    const oldPath = getPath(this.app, oldPathOrFile);
    const actualNewPath = await renameSafe({ app: this.app, newPath, oldPathOrAbstractFile: oldPathOrFile });
    this.pushUndo(async () => {
      await renameSafe({ app: this.app, newPath: oldPath, oldPathOrAbstractFile: actualNewPath });
    });
    return actualNewPath;
  }

  /**
   * Rolls back the transaction: undoes the completed steps in reverse order and removes the staging
   * folder. Idempotent.
   *
   * @returns A {@link Promise} that resolves when the rollback completes.
   */
  public async rollback(): Promise<void> {
    if (this.state === 'rolledBack') {
      return;
    }
    this.assertNotCommitted();
    this.state = 'rolledBack';
    for (const step of [...this.undoSteps].reverse()) {
      await step.undo();
    }
    await this.removeStagingFolder();
    this.disposeMutationBypass();
  }

  /**
   * Rolls back the transaction on disposal unless it was already committed or rolled back.
   */
  public async [Symbol.asyncDispose](): Promise<void> {
    if (this.state === 'open') {
      await this.rollback();
    }
  }

  /**
   * Soft-deletes a resource by moving it into the staging folder, recording the move-back as the
   * inverse. The real trash happens on {@link VaultTransaction.commit}. A no-op if the resource does
   * not exist.
   *
   * @param pathOrFile - The path or resource to trash.
   * @returns A {@link Promise} that resolves when the resource has been staged.
   */
  public async trash(pathOrFile: PathOrAbstractFile): Promise<void> {
    this.assertOpen();
    const file = getAbstractFileOrNull({ app: this.app, pathOrFile });
    if (!file) {
      return;
    }
    const originalPath = file.path;
    await this.ensureStagingFolder();
    const stagedPath = await this.getAvailableStagedPath(file.name);
    const adapter = this.app.vault.adapter;
    // Move through the adapter, not `vault.rename`: the staging folder is dot-prefixed and therefore
    // Untracked, so a `vault.*` move cannot target it (nor should it rewrite links to a soft-delete).
    await adapter.rename(originalPath, stagedPath);
    this.stagedTrashPaths.push(stagedPath);
    this.pushUndo(async () => {
      if (await adapter.exists(stagedPath)) {
        await adapter.rename(stagedPath, originalPath);
      }
    });
  }

  private assertNotCommitted(): void {
    if (this.state === 'committed') {
      throw new Error('Cannot roll back a committed transaction.');
    }
  }

  private assertOpen(): void {
    if (this.state !== 'open') {
      throw new Error(`Cannot mutate a ${this.state} transaction.`);
    }
  }

  private disposeMutationBypass(): void {
    this.mutationBypass?.[Symbol.dispose]();
    this.mutationBypass = null;
  }

  private async ensureStagingFolder(): Promise<void> {
    if (this.hasStagingFolder) {
      return;
    }
    const adapter = this.app.vault.adapter;
    if (!await adapter.exists(this.stagingFolderPath)) {
      await adapter.mkdir(this.stagingFolderPath);
    }
    this.hasStagingFolder = true;
  }

  private async getAvailableStagedPath(name: string): Promise<string> {
    const adapter = this.app.vault.adapter;
    const dotIndex = name.lastIndexOf('.');
    const hasExtension = dotIndex > 0;
    const baseName = hasExtension ? name.slice(0, dotIndex) : name;
    const extension = hasExtension ? name.slice(dotIndex) : '';
    let candidate = `${this.stagingFolderPath}/${name}`;
    let counter = 1;
    while (await adapter.exists(candidate)) {
      candidate = `${this.stagingFolderPath}/${baseName} ${counter.toString()}${extension}`;
      counter++;
    }
    return candidate;
  }

  private async hardDelete(path: string): Promise<void> {
    const file = getAbstractFileOrNull({ app: this.app, pathOrFile: path });
    if (file) {
      // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Undoing a transaction-local create must vanish it entirely, not land it in the user's trash.
      await this.app.vault.delete(file, true);
    }
  }

  private pushUndo(undo: () => Promise<void>): void {
    this.undoSteps.push({ undo });
  }

  private async removeStagingFolder(): Promise<void> {
    if (!this.hasStagingFolder) {
      return;
    }
    this.hasStagingFolder = false;
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(this.stagingFolderPath)) {
      await adapter.rmdir(this.stagingFolderPath, true);
    }
  }
}
