// @vitest-environment jsdom

import type {
  App as AppOriginal,
  WorkspaceLeaf as WorkspaceLeafOriginal
} from 'obsidian';

import {
  App,
  MarkdownView,
  WorkspaceLeaf
} from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { RetryWithTimeoutNoticeParams } from './async-with-notice.ts';

import { strictProxy } from '../strict-proxy.ts';
import { assertNonNullable } from '../type-guards.ts';
import { retryWithTimeoutNotice } from './async-with-notice.ts';
import { VaultTransaction } from './vault-transaction.ts';

vi.mock('./async-with-notice.ts', () => ({
  retryWithTimeoutNotice: vi.fn()
}));

const mockedRetryWithTimeoutNotice = vi.mocked(retryWithTimeoutNotice);
const DEFAULT_STAGING_FOLDER_PATH = '.obsidian-dev-utils-temp';
let app: AppOriginal;
let mockApp: App;

beforeEach(() => {
  mockApp = App.createConfigured__();
  app = mockApp.asOriginalType__();
  // Invoke the wrapped operation directly (bypassing the real retry/notice machinery) so that
  // `process` and `modify` actually mutate the in-memory vault.
  mockedRetryWithTimeoutNotice.mockImplementation(async (params: RetryWithTimeoutNoticeParams) => {
    const abortSignal = strictProxy<AbortSignal>({ throwIfAborted: vi.fn() });
    await params.operationFn(abortSignal);
  });
});

async function exists(path: string): Promise<boolean> {
  return app.vault.adapter.exists(path);
}

async function read(path: string): Promise<string> {
  return app.vault.adapter.read(path);
}

describe('VaultTransaction', () => {
  describe('trash', () => {
    it('should soft-delete a file and restore it with its original content on rollback', async () => {
      await app.vault.create('a.md', 'A');
      const vaultTransaction = new VaultTransaction({ app });
      await vaultTransaction.trash('a.md');
      expect(await exists('a.md')).toBe(false);

      await vaultTransaction.rollback();
      expect(await read('a.md')).toBe('A');
    });

    it('should soft-delete a whole folder subtree and restore it on rollback', async () => {
      await app.vault.createFolder('sub');
      await app.vault.createFolder('sub/nested');
      await app.vault.create('sub/a.md', 'A');
      await app.vault.create('sub/nested/c.md', 'C');
      const vaultTransaction = new VaultTransaction({ app });

      await vaultTransaction.trash('sub');
      expect(await exists('sub/a.md')).toBe(false);
      expect(await exists('sub/nested/c.md')).toBe(false);

      await vaultTransaction.rollback();
      expect(await read('sub/a.md')).toBe('A');
      expect(await read('sub/nested/c.md')).toBe('C');
    });

    it('should be a no-op when the resource does not exist', async () => {
      const vaultTransaction = new VaultTransaction({ app });
      await vaultTransaction.trash('missing.md');
      await vaultTransaction.rollback();
      expect(await exists(DEFAULT_STAGING_FOLDER_PATH)).toBe(false);
    });

    it('should pick an available staged path when two resources share a name', async () => {
      await app.vault.createFolder('x');
      await app.vault.createFolder('y');
      await app.vault.create('x/a.md', 'A1');
      await app.vault.create('y/a.md', 'A2');
      const vaultTransaction = new VaultTransaction({ app });

      await vaultTransaction.trash('x/a.md');
      await vaultTransaction.trash('y/a.md');
      expect(await exists('x/a.md')).toBe(false);
      expect(await exists('y/a.md')).toBe(false);

      await vaultTransaction.rollback();
      expect(await read('x/a.md')).toBe('A1');
      expect(await read('y/a.md')).toBe('A2');
    });

    it('should reuse a pre-existing staging folder', async () => {
      await app.vault.adapter.mkdir(DEFAULT_STAGING_FOLDER_PATH);
      await app.vault.create('a.md', 'A');
      const vaultTransaction = new VaultTransaction({ app });

      await vaultTransaction.trash('a.md');
      expect(await exists('a.md')).toBe(false);

      await vaultTransaction.rollback();
      expect(await read('a.md')).toBe('A');
    });

    it('should skip restoring when the staged resource was externally removed', async () => {
      await app.vault.create('a.md', 'A');
      const vaultTransaction = new VaultTransaction({ app });
      await vaultTransaction.trash('a.md');

      // Simulate an external wipe of the staging area before rollback.
      await app.vault.adapter.rmdir(DEFAULT_STAGING_FOLDER_PATH, true);

      await vaultTransaction.rollback();
      expect(await exists('a.md')).toBe(false);
      expect(await exists(DEFAULT_STAGING_FOLDER_PATH)).toBe(false);
    });

    it('should honor a custom staging folder path', async () => {
      const customStagingFolderPath = '.custom-temp';
      await app.vault.create('a.md', 'A');
      const vaultTransaction = new VaultTransaction({ app, stagingFolderPath: customStagingFolderPath });

      await vaultTransaction.trash('a.md');
      expect(await exists(customStagingFolderPath)).toBe(true);

      await vaultTransaction.commit();
      expect(await exists(customStagingFolderPath)).toBe(false);
    });
  });

  describe('commit', () => {
    it('should remove a soft-deleted resource for real and drop the staging folder', async () => {
      await app.vault.create('a.md', 'A');
      const vaultTransaction = new VaultTransaction({ app });
      await vaultTransaction.trash('a.md');

      await vaultTransaction.commit();
      expect(await exists('a.md')).toBe(false);
      expect(await exists(DEFAULT_STAGING_FOLDER_PATH)).toBe(false);
    });

    it('should fall back to trashLocal when trashSystem cannot handle the resource', async () => {
      await app.vault.create('a.md', 'A');
      const vaultTransaction = new VaultTransaction({ app });
      await vaultTransaction.trash('a.md');

      vi.spyOn(app.vault.adapter, 'trashSystem').mockResolvedValue(false);
      const trashLocalSpy = vi.spyOn(app.vault.adapter, 'trashLocal');

      await vaultTransaction.commit();
      expect(trashLocalSpy).toHaveBeenCalledOnce();
      expect(await exists('a.md')).toBe(false);
    });

    it('should throw when committing an already-committed transaction', async () => {
      const vaultTransaction = new VaultTransaction({ app });
      await vaultTransaction.commit();
      await expect(vaultTransaction.commit()).rejects.toThrow('Cannot mutate a committed transaction.');
    });
  });

  describe('create', () => {
    it('should create a file and delete it on rollback', async () => {
      const vaultTransaction = new VaultTransaction({ app });
      const file = await vaultTransaction.create('new.md', 'NEW');
      expect(file.path).toBe('new.md');
      expect(await read('new.md')).toBe('NEW');

      await vaultTransaction.rollback();
      expect(await exists('new.md')).toBe(false);
    });

    it('should skip the delete on rollback when the created file was externally removed', async () => {
      const vaultTransaction = new VaultTransaction({ app });
      const file = await vaultTransaction.create('new.md', 'NEW');
      // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Simulating an external permanent removal.
      await app.vault.delete(file);

      await vaultTransaction.rollback();
      expect(await exists('new.md')).toBe(false);
    });
  });

  describe('createFolder', () => {
    it('should create a folder and remove it on rollback', async () => {
      const vaultTransaction = new VaultTransaction({ app });
      await vaultTransaction.createFolder('newFolder');
      expect(await exists('newFolder')).toBe(true);

      await vaultTransaction.rollback();
      expect(await exists('newFolder')).toBe(false);
    });

    it('should not remove a folder that already existed', async () => {
      await app.vault.createFolder('existing');
      const vaultTransaction = new VaultTransaction({ app });
      await vaultTransaction.createFolder('existing');

      await vaultTransaction.rollback();
      expect(await exists('existing')).toBe(true);
    });
  });

  describe('modify / process', () => {
    it('should replace content on modify and restore it on rollback', async () => {
      await app.vault.create('a.md', 'OLD');
      const vaultTransaction = new VaultTransaction({ app });

      await vaultTransaction.modify('a.md', 'NEW');
      expect(await read('a.md')).toBe('NEW');

      await vaultTransaction.rollback();
      expect(await read('a.md')).toBe('OLD');
    });

    it('should transform content on process and restore it on rollback', async () => {
      await app.vault.create('a.md', 'abc');
      const vaultTransaction = new VaultTransaction({ app });

      await vaultTransaction.process('a.md', (content) => content.toUpperCase());
      expect(await read('a.md')).toBe('ABC');

      await vaultTransaction.rollback();
      expect(await read('a.md')).toBe('abc');
    });

    it('should reset a dirty open editor to the restored content on rollback so it cannot clobber the restore', async () => {
      await app.vault.create('a.md', 'OLD');
      const mockLeaf = WorkspaceLeaf.create2__(mockApp);
      const view = MarkdownView.create2__(mockLeaf).asOriginalType7__();
      const file = app.vault.getFileByPath('a.md');
      assertNonNullable(file);
      view.file = file;
      // `readSafe` -> `saveNote` reads `view.dirty`; keep it clean so it never flushes the mock editor.
      view.dirty = false;
      vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([strictProxy<WorkspaceLeafOriginal>({ view })]);

      const vaultTransaction = new VaultTransaction({ app });
      await vaultTransaction.modify('a.md', 'NEW');
      // The consumer edited the note THROUGH the editor: its buffer holds a dirty value.
      view.editor.setValue('DIRTY');

      await vaultTransaction.rollback();
      expect(await read('a.md')).toBe('OLD');
      expect(view.editor.getValue()).toBe('OLD');
    });
  });

  describe('rename', () => {
    it('should rename a resource and reverse it on rollback', async () => {
      await app.vault.create('a.md', 'A');
      const vaultTransaction = new VaultTransaction({ app });

      const actualNewPath = await vaultTransaction.rename('a.md', 'b.md');
      expect(actualNewPath).toBe('b.md');
      expect(await exists('b.md')).toBe(true);

      await vaultTransaction.rollback();
      expect(await exists('a.md')).toBe(true);
      expect(await exists('b.md')).toBe(false);
    });
  });

  describe('rollback', () => {
    it('should be idempotent', async () => {
      await app.vault.create('a.md', 'A');
      const vaultTransaction = new VaultTransaction({ app });
      await vaultTransaction.trash('a.md');

      await vaultTransaction.rollback();
      await vaultTransaction.rollback();
      expect(await read('a.md')).toBe('A');
    });

    it('should throw when rolling back a committed transaction', async () => {
      const vaultTransaction = new VaultTransaction({ app });
      await vaultTransaction.commit();
      await expect(vaultTransaction.rollback()).rejects.toThrow('Cannot roll back a committed transaction.');
    });

    it('should throw when mutating a rolled-back transaction', async () => {
      const vaultTransaction = new VaultTransaction({ app });
      await vaultTransaction.rollback();
      await expect(vaultTransaction.create('a.md', 'A')).rejects.toThrow('Cannot mutate a rolledBack transaction.');
    });
  });

  describe('Symbol.asyncDispose', () => {
    it('should roll back on disposal when neither committed nor rolled back', async () => {
      await app.vault.create('a.md', 'A');
      {
        await using vaultTransaction = new VaultTransaction({ app });
        await vaultTransaction.trash('a.md');
        expect(await exists('a.md')).toBe(false);
      }
      expect(await read('a.md')).toBe('A');
    });

    it('should not roll back on disposal after commit', async () => {
      await app.vault.create('a.md', 'A');
      {
        await using vaultTransaction = new VaultTransaction({ app });
        await vaultTransaction.trash('a.md');
        await vaultTransaction.commit();
      }
      expect(await exists('a.md')).toBe(false);
    });
  });

  describe('mutation bypass', () => {
    it('should open the bypass at construction and dispose it on commit', async () => {
      const disposeSpy = vi.fn();
      const openMutationBypass = vi.fn((): Disposable => ({ [Symbol.dispose]: disposeSpy }));

      const vaultTransaction = new VaultTransaction({ app, openMutationBypass });
      expect(openMutationBypass).toHaveBeenCalledOnce();
      expect(disposeSpy).not.toHaveBeenCalled();

      await vaultTransaction.commit();
      expect(disposeSpy).toHaveBeenCalledOnce();
    });

    it('should dispose the bypass on rollback', async () => {
      await app.vault.create('a.md', 'A');
      const disposeSpy = vi.fn();
      const vaultTransaction = new VaultTransaction({ app, openMutationBypass: (): Disposable => ({ [Symbol.dispose]: disposeSpy }) });

      await vaultTransaction.trash('a.md');
      await vaultTransaction.rollback();
      expect(disposeSpy).toHaveBeenCalledOnce();
    });

    it('should keep the bypass active through auto-rollback on disposal', async () => {
      await app.vault.create('a.md', 'A');
      const disposeSpy = vi.fn();
      {
        await using vaultTransaction = new VaultTransaction({ app, openMutationBypass: (): Disposable => ({ [Symbol.dispose]: disposeSpy }) });
        await vaultTransaction.trash('a.md');
      }
      // Disposal auto-rolled back and only then dropped the bypass.
      expect(disposeSpy).toHaveBeenCalledOnce();
      expect(await read('a.md')).toBe('A');
    });
  });
});
