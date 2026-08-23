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
  readonly hasDestinationAttachment: boolean;
  readonly hasSrcAttachment: boolean;
}

/**
 * The deletion primitive a folder-deletion test drives. All three are patched, and `FileManager.trashFile`
 * itself calls down into the other two, so each has to be proven independently.
 */
type DeletionPrimitive = 'trashFile' | 'vaultDelete' | 'vaultTrash';

/**
 * Input of a folder-deletion test.
 */
interface FolderDeletionInput {
  readonly deletionPrimitive: DeletionPrimitive;
  readonly [key: string]: unknown;
}

/**
 * Result of a folder-deletion test.
 */
interface FolderDeletionResult {
  readonly hasAttachmentFolder: boolean;
  readonly hasNoticeForSharedAttachment: boolean;
  readonly hasSharedAttachment: boolean;
  readonly hasSourceFolder: boolean;
  readonly hasSourceNote: boolean;
  readonly hasUnsharedAttachment: boolean;
}

/**
 * Result of a test asserting that Obsidian's own post-rename link update rewrote a link.
 */
interface NativeLinkUpdateResult {
  readonly referencingNoteContent: string;
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
        async callback({ app }) {
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
      const isFileGone = await evalInObsidian<Record<string, never>, boolean>({
        async callback({ app }) {
          const file = await app.vault.create('rdh-delete-test.md', '# Delete test\n');
          // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
          await app.vault.delete(file);
          return app.vault.getAbstractFileByPath('rdh-delete-test.md') === null;
        }
      });

      expect(isFileGone).toBe(true);
    });

    it('should create and delete a folder', async () => {
      const isFolderGone = await evalInObsidian<Record<string, never>, boolean>({
        async callback({ app }) {
          const folder = await app.vault.createFolder('rdh-test-folder');
          // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
          await app.vault.delete(folder, true);
          return app.vault.getAbstractFileByPath('rdh-test-folder') === null;
        }
      });

      expect(isFolderGone).toBe(true);
    });
  });

  describe('attachment move decoupled from update links (issue #154)', () => {
    it('should move the attachment folder when "Move attachments with note" is on but "Update links" is off', async () => {
      const result = await evalInObsidian<Record<string, never>, AttachmentMoveResult>({
        async callback({ app, lib: { AbortSignalComponent, PluginNoticeComponent, RenameDeleteHandlerComponent, waitUntil } }) {
          const PLUGIN_ID = 'rdh-decouple-test';
          const SRC_FOLDER = 'rdh-decouple-src';
          const DST_FOLDER = 'rdh-decouple-dst';
          const SRC_NOTE = `${SRC_FOLDER}/note.md`;
          const DST_NOTE = `${DST_FOLDER}/note.md`;
          const SRC_ATTACHMENT = `${SRC_FOLDER}/attachments/img.png`;
          const DST_ATTACHMENT = `${DST_FOLDER}/attachments/img.png`;
          const WAIT_TIMEOUT_IN_MILLISECONDS = 30_000;

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
              hasDestinationAttachment: app.vault.getAbstractFileByPath(DST_ATTACHMENT) !== null,
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

      expect(result.hasDestinationAttachment).toBe(true);
      expect(result.hasSrcAttachment).toBe(false);
    });
  });

  describe('does not interfere with a foreign locked transaction (issue #146)', () => {
    it('should not process a rename that occurs inside a foreign subtree-locked transaction', async () => {
      const result = await evalInObsidian<Record<string, never>, AttachmentMoveResult>({
        async callback({ app, lib: { AbortSignalComponent, flushQueue, PluginNoticeComponent, RenameDeleteHandlerComponent, ResourceLockComponent, waitUntil } }) {
          const PLUGIN_ID = 'rdh-foreign-lock-test';
          const FOREIGN_PLUGIN_ID = 'rdh-foreign-plugin';
          const SRC_FOLDER = 'rdh-foreign-src';
          const DST_FOLDER = 'rdh-foreign-dst';
          const SRC_NOTE = `${SRC_FOLDER}/note.md`;
          const DST_NOTE = `${DST_FOLDER}/note.md`;
          const SRC_ATTACHMENT = `${SRC_FOLDER}/attachments/img.png`;
          const DST_ATTACHMENT = `${DST_FOLDER}/attachments/img.png`;
          const WAIT_TIMEOUT_IN_MILLISECONDS = 30_000;

          const originalAttachmentFolderPath = app.vault.getConfig('attachmentFolderPath');
          app.vault.setConfig('attachmentFolderPath', './attachments');

          const abortSignalComponent = new AbortSignalComponent(PLUGIN_ID);
          const pluginNoticeComponent = new PluginNoticeComponent({ app, pluginName: 'RDH Foreign Lock Test' });
          const handlerComponent = new RenameDeleteHandlerComponent({
            abortSignalComponent,
            app,
            pluginId: PLUGIN_ID,
            pluginNoticeComponent,
            resourceLockComponent: null,
            // The Custom Attachment Location configuration from issue #146: move attachments with the note, do not update links.
            settingsBuilder: (): Partial<RenameDeleteHandlerSettings> => ({
              isNote: (path: string): boolean => path.endsWith('.md'),
              shouldHandleRenames: false,
              shouldRenameAttachmentFolder: true
            })
          });
          handlerComponent.load();

          // A foreign plugin (mirroring Advanced Note Composer's folder merge) that holds a subtree lock over the source folder for the duration of its own rename. A plain subtree lock is enough: the fix keys off the subtree lock's presence, independent of whether it also blocks mutations. The component's unload releases every lock it holds.
          const foreignResourceLockComponent = new ResourceLockComponent(app, FOREIGN_PLUGIN_ID);
          foreignResourceLockComponent.load();

          try {
            await app.vault.createFolder(`${SRC_FOLDER}/attachments`);
            await app.vault.createFolder(DST_FOLDER);
            await app.vault.createBinary(SRC_ATTACHMENT, new ArrayBuffer(8));
            const note = await app.vault.create(SRC_NOTE, `![[${SRC_ATTACHMENT}]]\n`);

            await waitUntil({
              message: 'note embed indexed by the metadata cache',
              predicate: () => (app.metadataCache.getFileCache(note)?.embeds?.length ?? 0) > 0,
              timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
            });

            foreignResourceLockComponent.lockForPath({ mode: 'subtree', operationName: 'Foreign merge', pathOrFile: SRC_FOLDER });
            foreignResourceLockComponent.lockForPath({ mode: 'subtree', operationName: 'Foreign merge', pathOrFile: DST_FOLDER });

            await app.fileManager.renameFile(note, DST_NOTE);
            /*
             * The handler schedules its attachment move onto the shared sequential queue synchronously
             * from the `rename` event (which has already fired by the time `renameFile` resolves), so
             * draining that queue deterministically drains any work the handler might have scheduled.
             * With the fix it schedules none, because the rename happens under the foreign subtree lock;
             * without the fix, the queued handler would move the attachment before this resolves.
             * `flushQueue` is used instead of `waitForAllAsyncOperations` because async-operation
             * tracking is a unit-test setup and is not enabled in the live Obsidian runtime.
             */
            await flushQueue();

            return {
              hasDestinationAttachment: app.vault.getAbstractFileByPath(DST_ATTACHMENT) !== null,
              hasSrcAttachment: app.vault.getAbstractFileByPath(SRC_ATTACHMENT) !== null
            };
          } finally {
            foreignResourceLockComponent.unload();
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

      // The foreign transaction owns its own link/attachment consistency, so the handler must stay out of the way: it does NOT move the attachment.
      expect(result.hasDestinationAttachment).toBe(false);
      expect(result.hasSrcAttachment).toBe(true);
    });
  });

  describe('does not disarm Obsidian\'s own link update when "Update links" is off (issue #47)', () => {
    it('should let Obsidian rewrite the embed when an attachment is renamed', async () => {
      const result = await evalInObsidian<Record<string, never>, NativeLinkUpdateResult>({
        async callback({ app, lib: { AbortSignalComponent, flushQueue, PluginNoticeComponent, RenameDeleteHandlerComponent, waitUntil } }) {
          const PLUGIN_ID = 'rdh-attachment-rename-test';
          const FOLDER = 'rdh-attachment-rename';
          const NOTE = `${FOLDER}/note.md`;
          const OLD_ATTACHMENT = `${FOLDER}/attachments/img.png`;
          const NEW_ATTACHMENT = `${FOLDER}/attachments/renamed.png`;
          const WAIT_TIMEOUT_IN_MILLISECONDS = 30_000;

          const originalAttachmentFolderPath = app.vault.getConfig('attachmentFolderPath');
          app.vault.setConfig('attachmentFolderPath', './attachments');
          // Obsidian only rewrites links without prompting when this is on; the prompt would block the headless run.
          const originalAlwaysUpdateLinks = app.vault.getConfig('alwaysUpdateLinks');
          app.vault.setConfig('alwaysUpdateLinks', true);

          const abortSignalComponent = new AbortSignalComponent(PLUGIN_ID);
          const pluginNoticeComponent = new PluginNoticeComponent({ app, pluginName: 'RDH Attachment Rename Test' });
          const handlerComponent = new RenameDeleteHandlerComponent({
            abortSignalComponent,
            app,
            pluginId: PLUGIN_ID,
            pluginNoticeComponent,
            resourceLockComponent: null,
            // The issue's settings combination: the handler still runs (it renames attachment files) but delegates every link rewrite to Obsidian.
            settingsBuilder: (): Partial<RenameDeleteHandlerSettings> => ({
              isNote: (path: string): boolean => path.endsWith('.md'),
              shouldHandleRenames: false,
              shouldRenameAttachmentFiles: true
            })
          });
          handlerComponent.load();

          try {
            await app.vault.createFolder(`${FOLDER}/attachments`);
            await app.vault.createBinary(OLD_ATTACHMENT, new ArrayBuffer(8));
            const note = await app.vault.create(NOTE, `![[${OLD_ATTACHMENT}]]\n`);

            await waitUntil({
              message: 'note embed indexed by the metadata cache',
              predicate: () => (app.metadataCache.getFileCache(note)?.embeds?.length ?? 0) > 0,
              timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
            });

            const attachment = app.vault.getFileByPath(OLD_ATTACHMENT);
            if (!attachment) {
              throw new Error(`Attachment ${OLD_ATTACHMENT} not found.`);
            }
            await app.fileManager.renameFile(attachment, NEW_ATTACHMENT);
            // Obsidian's link update and the handler's own queued work both settle after the rename resolves.
            await flushQueue();
            await waitUntil({
              message: 'renamed attachment indexed by the metadata cache',
              predicate: () => app.vault.getAbstractFileByPath(NEW_ATTACHMENT) !== null,
              timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
            });

            return { referencingNoteContent: await app.vault.read(note) };
          } finally {
            handlerComponent.unload();
            app.vault.setConfig('attachmentFolderPath', originalAttachmentFolderPath);
            app.vault.setConfig('alwaysUpdateLinks', originalAlwaysUpdateLinks);
            const folder = app.vault.getAbstractFileByPath(FOLDER);
            if (folder) {
              // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
              await app.vault.delete(folder, true);
            }
          }
        }
      });

      expect(result.referencingNoteContent).toContain('renamed.png');
      expect(result.referencingNoteContent).not.toContain('img.png');
    });

    it('should let Obsidian rewrite a backlink when a note is renamed', async () => {
      const result = await evalInObsidian<Record<string, never>, NativeLinkUpdateResult>({
        async callback({ app, lib: { AbortSignalComponent, flushQueue, PluginNoticeComponent, RenameDeleteHandlerComponent, waitUntil } }) {
          const PLUGIN_ID = 'rdh-note-rename-test';
          const FOLDER = 'rdh-note-rename';
          const OLD_NOTE = `${FOLDER}/note.md`;
          const NEW_NOTE = `${FOLDER}/renamed-note.md`;
          const REFERENCING_NOTE = `${FOLDER}/referencing-note.md`;
          const ATTACHMENT = `${FOLDER}/attachments/img.png`;
          const WAIT_TIMEOUT_IN_MILLISECONDS = 30_000;

          const originalAttachmentFolderPath = app.vault.getConfig('attachmentFolderPath');
          app.vault.setConfig('attachmentFolderPath', './attachments');
          const originalAlwaysUpdateLinks = app.vault.getConfig('alwaysUpdateLinks');
          app.vault.setConfig('alwaysUpdateLinks', true);

          const abortSignalComponent = new AbortSignalComponent(PLUGIN_ID);
          const pluginNoticeComponent = new PluginNoticeComponent({ app, pluginName: 'RDH Note Rename Test' });
          const handlerComponent = new RenameDeleteHandlerComponent({
            abortSignalComponent,
            app,
            pluginId: PLUGIN_ID,
            pluginNoticeComponent,
            resourceLockComponent: null,
            settingsBuilder: (): Partial<RenameDeleteHandlerSettings> => ({
              isNote: (path: string): boolean => path.endsWith('.md'),
              shouldHandleRenames: false,
              shouldRenameAttachmentFolder: true
            })
          });
          handlerComponent.load();

          try {
            await app.vault.createFolder(`${FOLDER}/attachments`);
            await app.vault.createBinary(ATTACHMENT, new ArrayBuffer(8));
            // The renamed note owns an attachment, so the handler reaches the attachment-folder lookup that registers the phantom old note.
            const note = await app.vault.create(OLD_NOTE, `![[${ATTACHMENT}]]\n`);
            const referencingNote = await app.vault.create(REFERENCING_NOTE, `[[${OLD_NOTE}]]\n`);

            await waitUntil({
              message: 'backlink to the renamed note indexed by the metadata cache',
              predicate: () =>
                (app.metadataCache.getFileCache(referencingNote)?.links?.length ?? 0) > 0
                && (app.metadataCache.getFileCache(note)?.embeds?.length ?? 0) > 0,
              timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
            });

            await app.fileManager.renameFile(note, NEW_NOTE);
            await flushQueue();
            await waitUntil({
              message: 'renamed note indexed by the metadata cache',
              predicate: () => app.vault.getAbstractFileByPath(NEW_NOTE) !== null,
              timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
            });

            return { referencingNoteContent: await app.vault.read(referencingNote) };
          } finally {
            handlerComponent.unload();
            app.vault.setConfig('attachmentFolderPath', originalAttachmentFolderPath);
            app.vault.setConfig('alwaysUpdateLinks', originalAlwaysUpdateLinks);
            const folder = app.vault.getAbstractFileByPath(FOLDER);
            if (folder) {
              // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
              await app.vault.delete(folder, true);
            }
          }
        }
      });

      expect(result.referencingNoteContent).toContain('renamed-note');
    });
  });

  describe('folder deletion does not destroy a still-referenced attachment (T558)', () => {
    it.each<DeletionPrimitive>(['trashFile', 'vaultDelete', 'vaultTrash'])(
      'should keep an attachment referenced from outside the deleted folder — via %s',
      async (deletionPrimitive) => {
        const result = await evalInObsidian<FolderDeletionInput, FolderDeletionResult>({
          async callback({ app, deletionPrimitive: primitive, lib: { AbortSignalComponent, getBacklinksForFileSafe, PluginNoticeComponent, RenameDeleteHandlerComponent, waitUntil } }) {
            const PLUGIN_ID = 'rdh-folder-delete-test';
            const SRC_FOLDER = 'rdh-folder-delete-src';
            const OTHER_FOLDER = 'rdh-folder-delete-other';
            const ATTACHMENT_FOLDER = `${SRC_FOLDER}/attachments`;
            const SRC_NOTE = `${SRC_FOLDER}/note.md`;
            const OTHER_NOTE = `${OTHER_FOLDER}/note.md`;
            const SHARED_ATTACHMENT = `${ATTACHMENT_FOLDER}/shared.png`;
            const UNSHARED_ATTACHMENT = `${ATTACHMENT_FOLDER}/unshared.png`;
            const EXPECTED_SHARED_BACKLINK_COUNT = 2;
            const ATTACHMENT_BYTE_LENGTH = 8;
            const WAIT_TIMEOUT_IN_MILLISECONDS = 30_000;

            const abortSignalComponent = new AbortSignalComponent(PLUGIN_ID);
            const pluginNoticeComponent = new PluginNoticeComponent({ app, pluginName: 'RDH Folder Delete Test' });
            const handlerComponent = new RenameDeleteHandlerComponent({
              abortSignalComponent,
              app,
              pluginId: PLUGIN_ID,
              pluginNoticeComponent,
              resourceLockComponent: null,
              settingsBuilder: (): Partial<RenameDeleteHandlerSettings> => ({
                isNote: (path: string): boolean => path.endsWith('.md'),
                shouldHandleDeletions: true
              })
            });
            handlerComponent.load();

            try {
              await app.vault.createFolder(ATTACHMENT_FOLDER);
              await app.vault.createFolder(OTHER_FOLDER);
              await app.vault.createBinary(SHARED_ATTACHMENT, new ArrayBuffer(ATTACHMENT_BYTE_LENGTH));
              await app.vault.createBinary(UNSHARED_ATTACHMENT, new ArrayBuffer(ATTACHMENT_BYTE_LENGTH));
              await app.vault.create(SRC_NOTE, `![[${SHARED_ATTACHMENT}]]\n![[${UNSHARED_ATTACHMENT}]]\n`);
              await app.vault.create(OTHER_NOTE, `![[${SHARED_ATTACHMENT}]]\n`);

              // The protection decides from backlinks, so both references have to be indexed before the folder goes.
              await waitUntil({
                message: 'both references to the shared attachment indexed by the metadata cache',
                predicate: async () => {
                  const backlinks = await getBacklinksForFileSafe({ app, pathOrFile: SHARED_ATTACHMENT });
                  return backlinks.count() === EXPECTED_SHARED_BACKLINK_COUNT;
                },
                timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
              });

              const srcFolder = app.vault.getFolderByPath(SRC_FOLDER);
              if (!srcFolder) {
                throw new Error(`${SRC_FOLDER} not found`);
              }

              switch (primitive) {
                case 'trashFile': {
                  await app.fileManager.trashFile(srcFolder);
                  break;
                }
                case 'vaultDelete': {
                  // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- The point of this case is that the raw primitive is protected too.
                  await app.vault.delete(srcFolder, true);
                  break;
                }
                case 'vaultTrash': {
                  // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- The point of this case is that the raw primitive is protected too.
                  await app.vault.trash(srcFolder, false);
                  break;
                }
                default: {
                  throw new Error(`Unknown deletion primitive: ${String(primitive)}`);
                }
              }

              const noticeTexts = [...activeDocument.querySelectorAll<HTMLElement>('.obsidian-dev-utils.plugin-notice-content')]
                .map((noticeContentEl) => noticeContentEl.textContent);

              return {
                hasAttachmentFolder: app.vault.getAbstractFileByPath(ATTACHMENT_FOLDER) !== null,
                hasNoticeForSharedAttachment: noticeTexts.some((noticeText) => noticeText.includes(SHARED_ATTACHMENT)),
                hasSharedAttachment: app.vault.getAbstractFileByPath(SHARED_ATTACHMENT) !== null,
                hasSourceFolder: app.vault.getAbstractFileByPath(SRC_FOLDER) !== null,
                hasSourceNote: app.vault.getAbstractFileByPath(SRC_NOTE) !== null,
                hasUnsharedAttachment: app.vault.getAbstractFileByPath(UNSHARED_ATTACHMENT) !== null
              };
            } finally {
              // Unload first: while the handler is loaded its patch would protect the shared attachment from this cleanup too.
              handlerComponent.unload();
              for (const folderPath of [SRC_FOLDER, OTHER_FOLDER]) {
                const folder = app.vault.getAbstractFileByPath(folderPath);
                if (folder) {
                  // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
                  await app.vault.delete(folder, true);
                }
              }
            }
          },
          input: { deletionPrimitive }
        });

        // The attachment another note still needs survives, together with the folders holding it...
        expect(result.hasSharedAttachment).toBe(true);
        expect(result.hasAttachmentFolder).toBe(true);
        expect(result.hasSourceFolder).toBe(true);
        expect(result.hasNoticeForSharedAttachment).toBe(true);

        // ...while everything nothing else references is deleted as it always was.
        expect(result.hasSourceNote).toBe(false);
        expect(result.hasUnsharedAttachment).toBe(false);
      }
    );

    it('should delete a folder whose attachment nothing outside it references', async () => {
      const result = await evalInObsidian<Record<string, never>, FolderDeletionResult>({
        async callback({ app, lib: { AbortSignalComponent, getBacklinksForFileSafe, PluginNoticeComponent, RenameDeleteHandlerComponent, waitUntil } }) {
          const PLUGIN_ID = 'rdh-folder-delete-control-test';
          const SRC_FOLDER = 'rdh-folder-delete-control-src';
          const ATTACHMENT_FOLDER = `${SRC_FOLDER}/attachments`;
          const SRC_NOTE = `${SRC_FOLDER}/note.md`;
          const UNSHARED_ATTACHMENT = `${ATTACHMENT_FOLDER}/unshared.png`;
          const ATTACHMENT_BYTE_LENGTH = 8;
          const WAIT_TIMEOUT_IN_MILLISECONDS = 30_000;

          const abortSignalComponent = new AbortSignalComponent(PLUGIN_ID);
          const pluginNoticeComponent = new PluginNoticeComponent({ app, pluginName: 'RDH Folder Delete Control Test' });
          const handlerComponent = new RenameDeleteHandlerComponent({
            abortSignalComponent,
            app,
            pluginId: PLUGIN_ID,
            pluginNoticeComponent,
            resourceLockComponent: null,
            settingsBuilder: (): Partial<RenameDeleteHandlerSettings> => ({
              isNote: (path: string): boolean => path.endsWith('.md'),
              shouldHandleDeletions: true
            })
          });
          handlerComponent.load();

          try {
            await app.vault.createFolder(ATTACHMENT_FOLDER);
            await app.vault.createBinary(UNSHARED_ATTACHMENT, new ArrayBuffer(ATTACHMENT_BYTE_LENGTH));
            await app.vault.create(SRC_NOTE, `![[${UNSHARED_ATTACHMENT}]]\n`);

            // Wait for the sole reference to be indexed, so the scan runs against a settled cache rather than an empty one.
            await waitUntil({
              message: 'the reference to the unshared attachment indexed by the metadata cache',
              predicate: async () => {
                const backlinks = await getBacklinksForFileSafe({ app, pathOrFile: UNSHARED_ATTACHMENT });
                return backlinks.count() === 1;
              },
              timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
            });

            const srcFolder = app.vault.getFolderByPath(SRC_FOLDER);
            if (!srcFolder) {
              throw new Error(`${SRC_FOLDER} not found`);
            }

            await app.fileManager.trashFile(srcFolder);

            return {
              hasAttachmentFolder: app.vault.getAbstractFileByPath(ATTACHMENT_FOLDER) !== null,
              hasNoticeForSharedAttachment: false,
              hasSharedAttachment: false,
              hasSourceFolder: app.vault.getAbstractFileByPath(SRC_FOLDER) !== null,
              hasSourceNote: app.vault.getAbstractFileByPath(SRC_NOTE) !== null,
              hasUnsharedAttachment: app.vault.getAbstractFileByPath(UNSHARED_ATTACHMENT) !== null
            };
          } finally {
            handlerComponent.unload();
            const folder = app.vault.getAbstractFileByPath(SRC_FOLDER);
            if (folder) {
              // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
              await app.vault.delete(folder, true);
            }
          }
        }
      });

      // Nothing is referenced from outside, so the deletion runs exactly as it did before the protection existed.
      expect(result.hasSourceFolder).toBe(false);
      expect(result.hasAttachmentFolder).toBe(false);
      expect(result.hasSourceNote).toBe(false);
      expect(result.hasUnsharedAttachment).toBe(false);
    });
  });
});
