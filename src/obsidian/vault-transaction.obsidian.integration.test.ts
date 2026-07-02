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
  inject,
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
      args: { stagingFolderPath: STAGING_FOLDER_PATH },
      async fn({ app, stagingFolderPath }): Promise<TrashRollbackResult> {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }

        const adapter = app.vault.adapter;
        const targetPath = 'vt-trash-target.md';
        const originalContent = 'original content';
        await app.vault.create(targetPath, originalContent);

        const vaultTransaction = new lib.obsidian['vault-transaction'].VaultTransaction({ app });
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
      vaultPath: inject('tempVaultPath')
    });

    expect(result.isOriginalGoneAfterTrash).toBe(true);
    expect(result.restoredContent).toBe('original content');
  });

  it('should remove a soft-deleted file for real and drop the staging folder on commit', async () => {
    const result = await evalInObsidian({
      args: { stagingFolderPath: STAGING_FOLDER_PATH },
      async fn({ app, stagingFolderPath }): Promise<CommitResult> {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }

        const adapter = app.vault.adapter;
        const targetPath = 'vt-commit-target.md';
        await app.vault.create(targetPath, 'to be committed away');

        const vaultTransaction = new lib.obsidian['vault-transaction'].VaultTransaction({ app });
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
      vaultPath: inject('tempVaultPath')
    });

    expect(result.isOriginalGoneAfterTrash).toBe(true);
    expect(result.isOriginalGoneAfterCommit).toBe(true);
    expect(result.isStagingFolderGoneAfterCommit).toBe(true);
  });

  it('should soft-delete a whole folder subtree on trash and restore it on rollback', async () => {
    const result = await evalInObsidian({
      args: { stagingFolderPath: STAGING_FOLDER_PATH },
      async fn({ app, stagingFolderPath }): Promise<SubtreeRollbackResult> {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }

        const adapter = app.vault.adapter;
        const folderPath = 'vt-subtree';
        const childPaths = ['vt-subtree/a.md', 'vt-subtree/nested/c.md'];
        const childContents = ['content a', 'content c'];

        await app.vault.createFolder(folderPath);
        await app.vault.createFolder('vt-subtree/nested');
        for (let i = 0; i < childPaths.length; i++) {
          const path = childPaths[i];
          const content = childContents[i];
          if (path === undefined || content === undefined) {
            throw new Error('test fixture mismatch');
          }
          await app.vault.create(path, content);
        }

        const vaultTransaction = new lib.obsidian['vault-transaction'].VaultTransaction({ app });
        try {
          await vaultTransaction.trash(folderPath);
          const goneFlags = await Promise.all(childPaths.map(async (path) => !await adapter.exists(path)));
          const areChildrenGoneAfterTrash = goneFlags.every((isGone) => isGone);

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
      vaultPath: inject('tempVaultPath')
    });

    expect(result.areChildrenGoneAfterTrash).toBe(true);
    expect(result.restoredChildContents).toEqual(['content a', 'content c']);
  });

  it('should mutate and roll back a mutation-blocked file when given an openMutationBypass', async () => {
    const result = await evalInObsidian({
      async fn({ app }): Promise<BypassResult> {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }

        const { ResourceLockComponent } = lib.obsidian['resource-lock'];
        const { VaultTransaction } = lib.obsidian['vault-transaction'];
        const folderPath = 'vt-bypass-folder';
        const filePath = `${folderPath}/note.md`;
        if (await app.vault.adapter.exists(folderPath)) {
          await app.vault.adapter.rmdir(folderPath, true);
        }
        await app.vault.createFolder(folderPath);
        const file = await app.vault.create(filePath, 'original');

        const component = new ResourceLockComponent(app, 'vt-bypass-plugin');
        // Lock the whole folder subtree against mutations.
        const lock = component.lockForPath(folderPath, { mode: 'subtree', shouldBlockMutations: true });

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
      },
      vaultPath: inject('tempVaultPath')
    });

    // The transaction mutated and rolled back a file under a mutation-blocking subtree lock.
    expect(result.wasModifyAllowedUnderLock).toBe(true);
    expect(result.wasRolledBackUnderLock).toBe(true);
  });
});
