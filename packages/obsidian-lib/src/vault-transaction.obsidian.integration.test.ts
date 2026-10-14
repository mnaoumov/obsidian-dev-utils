/**
 * @file
 *
 * Integration tests for {@link VaultTransaction} against a live Obsidian instance.
 *
 * These exercise the real soft-delete (adapter staging-move) / rollback / commit round-trips on a real
 * vault filesystem — the behavior the mocked-vault unit tests cannot faithfully verify. They confirm
 * that a soft-deleted file (and an entire folder subtree) is moved into the untracked dot-prefixed
 * staging folder on `trash`, restored at its original path with its original content on `rollback`, and
 * removed for real (staging folder gone) on `commit`.
 *
 * Assertions read the vault ADAPTER (`exists`/`read`), not the vault file-tree (`getAbstractFileByPath`):
 * the staging folder is dot-prefixed and therefore untracked, and the tree's reflection of the vanished
 * or restored original path arrives asynchronously via Obsidian's file watcher. The adapter reflects the
 * real filesystem synchronously, which is exactly the guarantee the transaction makes.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

interface BypassResult {
  readonly wasModifyAllowedUnderLock: boolean;
  readonly wasRolledBackUnderLock: boolean;
}

interface CommitResult {
  readonly isOriginalGoneAfterCommit: boolean;
  readonly isOriginalGoneAfterTrash: boolean;
  readonly isStagingFolderGoneAfterCommit: boolean;
}

interface CopyRollbackResult {
  readonly areCopiesGoneAfterRollback: boolean;
  readonly copiedBinaryBytes: readonly number[];
  readonly copiedChildContent: null | string;
  readonly originalBinaryBytesAfterRollback: readonly number[];
}

interface EditorClobberResult {
  readonly diskAfterRollbackAndSave: string;
  readonly editorAfterRollbackAndSave: string;
}

interface SubtreeRollbackResult {
  readonly areChildrenGoneAfterTrash: boolean;
  readonly restoredChildContents: readonly string[];
}

interface TrashRollbackResult {
  readonly isOriginalGoneAfterTrash: boolean;
  readonly restoredContent: null | string;
}

const STAGING_FOLDER_PATH = '.obsidian-dev-utils-temp';

describe('VaultTransaction', () => {
  it('should soft-delete a file on trash and restore it with its original content on rollback', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { VaultTransaction }, stagingFolderPath }): Promise<TrashRollbackResult> {
        const adapter = app.vault.adapter;
        const targetPath = 'vt-trash-target.md';
        const originalContent = 'original content';
        await app.vault.create(targetPath, originalContent);

        const vaultTransaction = new VaultTransaction({ app });
        try {
          await vaultTransaction.trash(targetPath);
          const isOriginalGoneAfterTrash = !await adapter.exists(targetPath);

          await vaultTransaction.rollback();
          const restoredContent = await adapter.exists(targetPath) ? await adapter.read(targetPath) : null;

          return {
            isOriginalGoneAfterTrash,
            restoredContent
          };
        } finally {
          for (const path of [targetPath, stagingFolderPath]) {
            if (await adapter.exists(path)) {
              await adapter.trashLocal(path);
            }
          }
        }
      },
      input: { stagingFolderPath: STAGING_FOLDER_PATH }
    });

    expect(result.isOriginalGoneAfterTrash).toBe(true);
    expect(result.restoredContent).toBe('original content');
  });

  it('should remove a soft-deleted file for real and drop the staging folder on commit', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { VaultTransaction }, stagingFolderPath }): Promise<CommitResult> {
        const adapter = app.vault.adapter;
        const targetPath = 'vt-commit-target.md';
        await app.vault.create(targetPath, 'to be committed away');

        const vaultTransaction = new VaultTransaction({ app });
        try {
          await vaultTransaction.trash(targetPath);
          const isOriginalGoneAfterTrash = !await adapter.exists(targetPath);

          await vaultTransaction.commit();
          const isOriginalGoneAfterCommit = !await adapter.exists(targetPath);
          const isStagingFolderGoneAfterCommit = !await adapter.exists(stagingFolderPath);

          return {
            isOriginalGoneAfterCommit,
            isOriginalGoneAfterTrash,
            isStagingFolderGoneAfterCommit
          };
        } finally {
          for (const path of [targetPath, stagingFolderPath]) {
            if (await adapter.exists(path)) {
              await adapter.trashLocal(path);
            }
          }
        }
      },
      input: { stagingFolderPath: STAGING_FOLDER_PATH }
    });

    expect(result.isOriginalGoneAfterTrash).toBe(true);
    expect(result.isOriginalGoneAfterCommit).toBe(true);
    expect(result.isStagingFolderGoneAfterCommit).toBe(true);
  });

  it('should soft-delete a whole folder subtree on trash and restore it on rollback', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { VaultTransaction }, stagingFolderPath }): Promise<SubtreeRollbackResult> {
        const adapter = app.vault.adapter;
        const folderPath = 'vt-subtree';
        const childPaths = ['vt-subtree/a.md', 'vt-subtree/nested/c.md'];
        const childContents = ['content a', 'content c'];

        await app.vault.createFolder(folderPath);
        await app.vault.createFolder('vt-subtree/nested');
        for (const [index, path] of childPaths.entries()) {
          const content = childContents[index];
          if (content === undefined) {
            throw new Error('test fixture mismatch');
          }
          await app.vault.create(path, content);
        }

        const vaultTransaction = new VaultTransaction({ app });
        try {
          await vaultTransaction.trash(folderPath);
          const goneFlags = await Promise.all(childPaths.map(async (path) => !await adapter.exists(path)));
          const areChildrenGoneAfterTrash = goneFlags.every(Boolean);

          await vaultTransaction.rollback();
          const restoredChildContents: string[] = [];
          for (const path of childPaths) {
            if (await adapter.exists(path)) {
              restoredChildContents.push(await adapter.read(path));
            }
          }

          return {
            areChildrenGoneAfterTrash,
            restoredChildContents
          };
        } finally {
          for (const path of [folderPath, stagingFolderPath]) {
            if (await adapter.exists(path)) {
              await adapter.trashLocal(path);
            }
          }
        }
      },
      input: { stagingFolderPath: STAGING_FOLDER_PATH }
    });

    expect(result.areChildrenGoneAfterTrash).toBe(true);
    expect(result.restoredChildContents).toEqual(['content a', 'content c']);
  });

  it('should copy a binary file and a folder subtree, and remove only the copies on rollback', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { VaultTransaction } }): Promise<CopyRollbackResult> {
        const adapter = app.vault.adapter;
        const binaryPath = 'vt-copy-source.bin';
        const binaryCopyPath = 'vt-copy-target.bin';
        const folderPath = 'vt-copy-subtree';
        const folderCopyPath = 'vt-copy-subtree-copy';
        const copiedChildPath = `${folderCopyPath}/nested/c.md`;
        const bytes = [0, 1, 2, 253, 254, 255];
        const buffer = new ArrayBuffer(bytes.length);
        new Uint8Array(buffer).set(bytes);

        await app.vault.createBinary(binaryPath, buffer);
        await app.vault.createFolder(folderPath);
        await app.vault.createFolder(`${folderPath}/nested`);
        await app.vault.create(`${folderPath}/nested/c.md`, 'content c');

        const vaultTransaction = new VaultTransaction({ app });
        try {
          await vaultTransaction.copy(binaryPath, binaryCopyPath);
          await vaultTransaction.copy(folderPath, folderCopyPath);
          const copiedBinaryBytes = [...new Uint8Array(await adapter.readBinary(binaryCopyPath))];
          const copiedChildContent = await adapter.exists(copiedChildPath) ? await adapter.read(copiedChildPath) : null;

          await vaultTransaction.rollback();
          const areCopiesGoneAfterRollback = !await adapter.exists(binaryCopyPath) && !await adapter.exists(folderCopyPath);
          const originalBinaryBytesAfterRollback = [...new Uint8Array(await adapter.readBinary(binaryPath))];

          return {
            areCopiesGoneAfterRollback,
            copiedBinaryBytes,
            copiedChildContent,
            originalBinaryBytesAfterRollback
          };
        } finally {
          for (const path of [binaryPath, binaryCopyPath, folderPath, folderCopyPath]) {
            if (await adapter.exists(path)) {
              await adapter.trashLocal(path);
            }
          }
        }
      }
    });

    expect(result.copiedBinaryBytes).toEqual([0, 1, 2, 253, 254, 255]);
    expect(result.copiedChildContent).toBe('content c');
    expect(result.areCopiesGoneAfterRollback).toBe(true);
    expect(result.originalBinaryBytesAfterRollback).toEqual([0, 1, 2, 253, 254, 255]);
  });

  it('should mutate and roll back a mutation-blocked file when given an openMutationBypass', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { ResourceLockComponent, VaultTransaction } }): Promise<BypassResult> {
        const folderPath = 'vt-bypass-folder';
        const filePath = `${folderPath}/note.md`;
        if (await app.vault.adapter.exists(folderPath)) {
          await app.vault.adapter.rmdir(folderPath, true);
        }
        await app.vault.createFolder(folderPath);
        const file = await app.vault.create(filePath, 'original');

        const component = new ResourceLockComponent(app, 'vt-bypass-plugin');
        // Lock the whole folder subtree against mutations.
        const lock = component.lockForPath({ mode: 'subtree', operationName: 'Integration test', pathOrFile: folderPath, shouldBlockMutations: true });

        try {
          const vaultTransaction = new VaultTransaction({
            app,
            openMutationBypass: (): Disposable => component.bypassBlockedMutations([folderPath])
          });
          // The transaction's own write passes the blocker via the bypass scope.
          await vaultTransaction.modify(filePath, 'changed by transaction');
          const wasModifyAllowedUnderLock = await app.vault.read(file) === 'changed by transaction';
          // Rollback must also pass the blocker (its restore write) — the bypass stays active through it.
          await vaultTransaction.rollback();
          const wasRolledBackUnderLock = await app.vault.read(file) === 'original';
          return {
            wasModifyAllowedUnderLock,
            wasRolledBackUnderLock
          };
        } finally {
          lock[Symbol.dispose]();
          if (await app.vault.adapter.exists(folderPath)) {
            await app.vault.adapter.rmdir(folderPath, true);
          }
        }
      }
    });

    // The transaction mutated and rolled back a file under a mutation-blocking subtree lock.
    expect(result.wasModifyAllowedUnderLock).toBe(true);
    expect(result.wasRolledBackUnderLock).toBe(true);
  });

  it('should leave both disk and an open editor at the restored content after rollback', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { VaultTransaction }, obsidianModule }): Promise<EditorClobberResult> {
        const { MarkdownView } = obsidianModule;
        const targetPath = 'vt-editor-clobber.md';
        const originalContent = 'first\nmiddle\nlast\n';
        const extractedContent = 'first\n\nlast\n';

        const file = await app.vault.create(targetPath, originalContent);
        const leaf = app.workspace.getLeaf(true);
        try {
          await leaf.openFile(file);
          const view = leaf.view;
          if (!(view instanceof MarkdownView)) {
            throw new TypeError('expected a MarkdownView');
          }
          const editor = view.editor;

          const vaultTransaction = new VaultTransaction({ app });
          // Capture the pre-image (still `originalContent`) and write the extraction to disk.
          await vaultTransaction.modify(targetPath, extractedContent);
          // Mimic a consumer that edited the note THROUGH the editor (e.g. a split via
          // `editor.replaceSelection`): the editor now holds a dirty buffer = the extraction.
          editor.setValue(extractedContent);

          // Rollback restores the disk content and syncs the open editor's buffer to match.
          // VaultTransaction's restore is already editor-safe on its own.
          // Its `readSafe` -> `saveNote` flushes the dirty buffer, then the clean editor reloads.
          // This test therefore guards the end-to-end invariant rather than isolating that machinery.
          await vaultTransaction.rollback();

          // Force the editor's buffer to disk; it must be the restored content, not the extraction.
          await view.save();

          return {
            diskAfterRollbackAndSave: await app.vault.adapter.read(targetPath),
            editorAfterRollbackAndSave: editor.getValue()
          };
        } finally {
          leaf.detach();
          if (await app.vault.adapter.exists(targetPath)) {
            await app.vault.adapter.trashLocal(targetPath);
          }
        }
      }
    });

    expect(result.diskAfterRollbackAndSave).toBe('first\nmiddle\nlast\n');
    expect(result.editorAfterRollbackAndSave).toBe('first\nmiddle\nlast\n');
  });
});
