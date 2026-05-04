/**
 * @file
 *
 * Integration tests for the rename/delete handler.
 * Runs against a live Obsidian instance via CLI transport.
 *
 * These tests verify vault file operations (rename, delete) that are
 * foundational to the rename-delete-handler module.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import {
  evalInObsidian,
  TempVault
} from 'obsidian-integration-testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

/**
 * Result of the link update test after rename.
 */
interface LinkUpdateResult {
  content: string;
  hasUpdatedLink: boolean;
}

/**
 * Result of the rename handler test.
 */
interface RenameTestResult {
  hasNewFile: boolean;
  hasOldFile: boolean;
}

let tempVault: TempVault;

beforeEach(async () => {
  tempVault = new TempVault();
  tempVault.populate({
    'folder/nested-note.md': '# Nested\n\nIn a folder.\n',
    'note-with-link.md': '# Note\n\nSee [[target-note]].\n',
    'target-note.md': '# Target\n\nSome content.\n'
  });
  await tempVault.register();
});

afterEach(async () => {
  await tempVault.dispose();
});

describe('rename-delete-handler', () => {
  describe('file rename operations', () => {
    it('should rename a file in the vault', async () => {
      const result = await evalInObsidian<Record<string, never>, RenameTestResult>({
        fn({ app }) {
          const file = app.vault.getAbstractFileByPath('target-note.md');
          if (!file) {
            throw new Error('target-note.md not found');
          }
          return app.fileManager.renameFile(file, 'renamed-note.md').then(() => ({
            hasNewFile: app.vault.getAbstractFileByPath('renamed-note.md') !== null,
            hasOldFile: app.vault.getAbstractFileByPath('target-note.md') !== null
          }));
        },
        vaultPath: tempVault.path
      });

      expect(result.hasNewFile).toBe(true);
      expect(result.hasOldFile).toBe(false);
    });

    it('should rename a file into a different folder', async () => {
      const result = await evalInObsidian<Record<string, never>, RenameTestResult>({
        fn({ app }) {
          const file = app.vault.getAbstractFileByPath('target-note.md');
          if (!file) {
            throw new Error('target-note.md not found');
          }
          return app.fileManager.renameFile(file, 'folder/moved-note.md').then(() => ({
            hasNewFile: app.vault.getAbstractFileByPath('folder/moved-note.md') !== null,
            hasOldFile: app.vault.getAbstractFileByPath('target-note.md') !== null
          }));
        },
        vaultPath: tempVault.path
      });

      expect(result.hasNewFile).toBe(true);
      expect(result.hasOldFile).toBe(false);
    });

    it('should update links when renaming via fileManager', async () => {
      const result = await evalInObsidian<Record<string, never>, LinkUpdateResult>({
        fn({ app }) {
          const file = app.vault.getAbstractFileByPath('target-note.md');
          if (!file) {
            throw new Error('target-note.md not found');
          }
          return app.fileManager.renameFile(file, 'new-target.md').then(async () => {
            const linkerFile = app.vault.getAbstractFileByPath('note-with-link.md');
            if (!linkerFile) {
              throw new Error('note-with-link.md not found');
            }
            const content = await app.vault.read(linkerFile as import('obsidian').TFile);
            return {
              content,
              hasUpdatedLink: content.includes('[[new-target]]')
            };
          });
        },
        vaultPath: tempVault.path
      });

      expect(result.hasUpdatedLink).toBe(true);
    });
  });

  describe('file delete operations', () => {
    it('should delete a file from the vault', async () => {
      const result = await evalInObsidian<Record<string, never>, boolean>({
        fn({ app }) {
          const file = app.vault.getAbstractFileByPath('target-note.md');
          if (!file) {
            throw new Error('target-note.md not found');
          }
          return app.fileManager.trashFile(file).then(() => app.vault.getAbstractFileByPath('target-note.md') === null);
        },
        vaultPath: tempVault.path
      });

      expect(result).toBe(true);
    });

    it('should delete a folder from the vault', async () => {
      const result = await evalInObsidian<Record<string, never>, boolean>({
        fn({ app }) {
          const folder = app.vault.getAbstractFileByPath('folder');
          if (!folder) {
            throw new Error('folder not found');
          }
          return app.fileManager.trashFile(folder).then(() => app.vault.getAbstractFileByPath('folder') === null);
        },
        vaultPath: tempVault.path
      });

      expect(result).toBe(true);
    });
  });

  describe('registerRenameDeleteHandlers export', () => {
    it('should export registerRenameDeleteHandlers as a function', async () => {
      const result = await evalInObsidian<Record<string, never>, boolean>({
        fn() {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }
          return typeof lib.obsidian.rename_delete_handler.registerRenameDeleteHandlers === 'function';
        },
        vaultPath: tempVault.path
      });

      expect(result).toBe(true);
    });
  });
});
