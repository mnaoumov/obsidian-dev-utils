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
  it
} from 'vitest';

import type { RenameDeleteHandlerSettings } from './rename-delete-handler-component.ts';

/**
 * Result of the attachment-move decoupling test.
 */
interface AttachmentMoveResult {
  readonly hasDstAttachment: boolean;
  readonly hasSrcAttachment: boolean;
}

/**
 * Result of the rename test.
 */
interface RenameTestResult {
  readonly hasNewFile: boolean;
  readonly hasOldFile: boolean;
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
        }
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
        }
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
        }
      });

      expect(result).toBe(true);
    });
  });

  describe('attachment move decoupled from update links (issue #154)', () => {
    it('should move the attachment folder when "Move attachments with note" is on but "Update links" is off', async () => {
      const result = await evalInObsidian<Record<string, never>, AttachmentMoveResult>({
        async fn({ app, lib: { AbortSignalComponent, PluginNoticeComponent, RenameDeleteHandlerComponent, waitUntil } }) {
          const PLUGIN_ID = 'rdh-decouple-test';
          const SRC_FOLDER = 'rdh-decouple-src';
          const DST_FOLDER = 'rdh-decouple-dst';
          const SRC_NOTE = `${SRC_FOLDER}/note.md`;
          const DST_NOTE = `${DST_FOLDER}/note.md`;
          const SRC_ATTACHMENT = `${SRC_FOLDER}/attachments/img.png`;
          const DST_ATTACHMENT = `${DST_FOLDER}/attachments/img.png`;
          const WAIT_TIMEOUT_IN_MILLISECONDS = 30000;

          // Core "In subfolder under current folder" mode puts attachments in an `attachments` subfolder next to the note — the only mode in which the issue is observable.
          const originalAttachmentFolderPath = app.vault.getConfig('attachmentFolderPath');
          app.vault.setConfig('attachmentFolderPath', './attachments');

          const abortSignalComponent = new AbortSignalComponent(PLUGIN_ID);
          const pluginNoticeComponent = new PluginNoticeComponent({ app, pluginName: 'RDH Decouple Test' });
          const handlerComponent = new RenameDeleteHandlerComponent({
            abortSignalComponent,
            app,
            pluginId: PLUGIN_ID,
            pluginNoticeComponent,
            resourceLockComponent: null,
            // Enable "Move attachments with note" but disable "Update links" — the two independent flags this fix decouples.
            settingsBuilder: (): Partial<RenameDeleteHandlerSettings> => ({
              isNote: (path: string): boolean => path.endsWith('.md'),
              shouldHandleRenames: false,
              shouldRenameAttachmentFolder: true
            })
          });
          handlerComponent.load();

          try {
            await app.vault.createFolder(`${SRC_FOLDER}/attachments`);
            await app.vault.createFolder(DST_FOLDER);
            await app.vault.createBinary(SRC_ATTACHMENT, new ArrayBuffer(8));
            const note = await app.vault.create(SRC_NOTE, `![[${SRC_ATTACHMENT}]]\n`);

            // RenameMap.fill relocates the attachment via the note's links, so wait for the metadata cache to index the embed before moving.
            await waitUntil({
              message: 'note embed indexed by the metadata cache',
              predicate: () => (app.metadataCache.getFileCache(note)?.embeds?.length ?? 0) > 0,
              timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
            });

            await app.fileManager.renameFile(note, DST_NOTE);

            // The handleRename hook schedules the move on the async queue, so poll for the relocated attachment instead of waiting a fixed delay.
            await waitUntil({
              message: 'attachment moved into the destination attachments subfolder',
              predicate: () => app.vault.getAbstractFileByPath(DST_ATTACHMENT) !== null,
              timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
            });

            return {
              hasDstAttachment: app.vault.getAbstractFileByPath(DST_ATTACHMENT) !== null,
              hasSrcAttachment: app.vault.getAbstractFileByPath(SRC_ATTACHMENT) !== null
            };
          } finally {
            handlerComponent.unload();
            app.vault.setConfig('attachmentFolderPath', originalAttachmentFolderPath);
            for (const folderPath of [SRC_FOLDER, DST_FOLDER]) {
              const folder = app.vault.getAbstractFileByPath(folderPath);
              if (folder) {
                // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
                await app.vault.delete(folder, true);
              }
            }
          }
        }
      });

      expect(result.hasDstAttachment).toBe(true);
      expect(result.hasSrcAttachment).toBe(false);
    });
  });
});
