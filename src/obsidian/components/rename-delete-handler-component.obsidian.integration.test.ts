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

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  inject,
  it
} from 'vitest';

/**
 * Result of the rename test.
 */
interface RenameTestResult {
  hasNewFile: boolean;
  hasOldFile: boolean;
}

describe('rename-delete-handler', () => {
  describe('file operations', () => {
    it('should rename a file in the vault', async () => {
      const result = await evalInObsidian<Record<string, never>, RenameTestResult>({
        async fn({ app }) {
          const file = await app.vault.create('rdh-rename-test.md', '# Rename test\n');
          try {
            await app.vault.rename(file, 'rdh-renamed-test.md');
            return {
              hasNewFile: app.vault.getAbstractFileByPath('rdh-renamed-test.md') !== null,
              hasOldFile: app.vault.getAbstractFileByPath('rdh-rename-test.md') !== null
            };
          } finally {
            const f = app.vault.getAbstractFileByPath('rdh-renamed-test.md')
              ?? app.vault.getAbstractFileByPath('rdh-rename-test.md');
            if (f) {
              // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
              await app.vault.delete(f);
            }
          }
        },
        vaultPath: inject('tempVaultPath')
      });

      expect(result.hasNewFile).toBe(true);
      expect(result.hasOldFile).toBe(false);
    });

    it('should delete a file from the vault', async () => {
      const result = await evalInObsidian<Record<string, never>, boolean>({
        async fn({ app }) {
          const file = await app.vault.create('rdh-delete-test.md', '# Delete test\n');
          // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
          await app.vault.delete(file);
          return app.vault.getAbstractFileByPath('rdh-delete-test.md') === null;
        },
        vaultPath: inject('tempVaultPath')
      });

      expect(result).toBe(true);
    });

    it('should create and delete a folder', async () => {
      const result = await evalInObsidian<Record<string, never>, boolean>({
        async fn({ app }) {
          const folder = await app.vault.createFolder('rdh-test-folder');
          // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
          await app.vault.delete(folder, true);
          return app.vault.getAbstractFileByPath('rdh-test-folder') === null;
        },
        vaultPath: inject('tempVaultPath')
      });

      expect(result).toBe(true);
    });
  });
});
