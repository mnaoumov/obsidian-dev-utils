/**
 * @file
 *
 * Integration tests for the attachment path utility functions.
 * Runs against a live Obsidian instance via CLI transport.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

/**
 * What one `attachmentFolderPath` mode resolves to, as computed by the library and by Obsidian itself.
 */
interface AttachmentFolderModeResult {
  readonly hasOwnFolder: boolean;
  readonly libraryAttachmentPath: string;
  readonly libraryFolderPath: string;
  readonly mode: string;
  readonly obsidianAttachmentPath: string;
}

/**
 * What one `attachmentFolderPath` mode resolves to, asynchronously and synchronously.
 */
interface SyncAttachmentFolderModeResult {
  readonly asyncFolderPath: string;
  readonly mode: string;
  readonly syncFolderPath: null | string;
}

describe('attachment-path', () => {
  describe('getAttachmentFolderPath', () => {
    it('should return the attachment folder path for a note', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        // eslint-disable-next-line unicorn/name-replacements -- `fn` is declared by `obsidian-integration-testing`; renaming it here would not match the API.
        fn({ app, lib: { getAttachmentFolderPath } }) {
          return getAttachmentFolderPath({ app, notePathOrFile: 'test-note.md' });
        }
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should match what Obsidian itself resolves for every attachment folder mode', async () => {
      const results = await evalInObsidian<Record<string, never>, AttachmentFolderModeResult[]>({
        // eslint-disable-next-line unicorn/name-replacements -- `fn` is declared by `obsidian-integration-testing`; renaming it here would not match the API.
        async fn({ app, lib: { AttachmentPathContext, getAttachmentFilePath, getAttachmentFolderPath, hasOwnAttachmentFolder } }) {
          const ROOT_FOLDER = 't224-attachment-path';
          const NOTE_FOLDER = `${ROOT_FOLDER}/docs`;
          const NOTE_PATH = `${NOTE_FOLDER}/note.md`;
          const FIXED_FOLDER = `${ROOT_FOLDER}/files`;
          const PROBE_BASE_NAME = 't224-probe';

          const originalAttachmentFolderPath = app.vault.getConfig('attachmentFolderPath');

          try {
            await app.vault.createFolder(NOTE_FOLDER);
            await app.vault.createFolder(FIXED_FOLDER);
            const note = await app.vault.create(NOTE_PATH, '# T224\n');

            const modeResults: AttachmentFolderModeResult[] = [];

            for (const mode of ['/', FIXED_FOLDER, './', './assets']) {
              app.vault.setConfig('attachmentFolderPath', mode);
              modeResults.push({
                hasOwnFolder: await hasOwnAttachmentFolder({ app, path: NOTE_PATH }),
                libraryAttachmentPath: await getAttachmentFilePath({
                  app,
                  context: AttachmentPathContext.Unknown,
                  notePathOrFile: NOTE_PATH,
                  oldAttachmentPathOrFile: `${PROBE_BASE_NAME}.png`,
                  shouldSkipDuplicateCheck: true
                }),
                libraryFolderPath: await getAttachmentFolderPath({ app, notePathOrFile: NOTE_PATH }),
                mode,
                obsidianAttachmentPath: await app.vault.getAvailablePathForAttachments(PROBE_BASE_NAME, 'png', note)
              });
            }

            return modeResults;
          } finally {
            app.vault.setConfig('attachmentFolderPath', originalAttachmentFolderPath);
            const rootFolder = app.vault.getAbstractFileByPath(ROOT_FOLDER);
            if (rootFolder) {
              // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
              await app.vault.delete(rootFolder, true);
            }
          }
        }
      });

      // The library must agree with Obsidian's own resolution in every mode.
      for (const result of results) {
        expect(result.libraryAttachmentPath).toBe(result.obsidianAttachmentPath);
      }

      expect(results.map((result) => result.libraryFolderPath)).toEqual([
        '/',
        't224-attachment-path/files',
        't224-attachment-path/docs',
        't224-attachment-path/docs/assets'
      ]);

      // Every built-in mode is shared by all the notes of the folder, so none of them is the note's own.
      expect(results.map((result) => result.hasOwnFolder)).toEqual([false, false, false, false]);
    });
  });

  describe('getAttachmentFolderPathSyncOrNull', () => {
    it('should agree with the async twin for every attachment folder mode', async () => {
      const results = await evalInObsidian<Record<string, never>, SyncAttachmentFolderModeResult[]>({
        // eslint-disable-next-line unicorn/name-replacements -- `fn` is declared by `obsidian-integration-testing`; renaming it here would not match the API.
        async fn({ app, lib: { getAttachmentFolderPath, getAttachmentFolderPathSyncOrNull } }) {
          const ROOT_FOLDER = 't357-attachment-path-sync';
          const NOTE_FOLDER = `${ROOT_FOLDER}/docs`;
          const NOTE_PATH = `${NOTE_FOLDER}/note.md`;
          const FIXED_FOLDER = `${ROOT_FOLDER}/files`;

          const originalAttachmentFolderPath = app.vault.getConfig('attachmentFolderPath');

          try {
            await app.vault.createFolder(NOTE_FOLDER);
            await app.vault.createFolder(FIXED_FOLDER);
            await app.vault.create(NOTE_PATH, '# T357\n');

            const modeResults: SyncAttachmentFolderModeResult[] = [];

            for (const mode of ['/', FIXED_FOLDER, './', './assets']) {
              app.vault.setConfig('attachmentFolderPath', mode);
              modeResults.push({
                asyncFolderPath: await getAttachmentFolderPath({ app, notePathOrFile: NOTE_PATH }),
                mode,
                syncFolderPath: getAttachmentFolderPathSyncOrNull({ app, notePathOrFile: NOTE_PATH })
              });
            }

            return modeResults;
          } finally {
            app.vault.setConfig('attachmentFolderPath', originalAttachmentFolderPath);
            const rootFolder = app.vault.getAbstractFileByPath(ROOT_FOLDER);
            if (rootFolder) {
              // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
              await app.vault.delete(rootFolder, true);
            }
          }
        }
      });

      // No attachment-location plugin is installed in the test vault, so every mode is answerable synchronously.
      for (const result of results) {
        expect(result.syncFolderPath).toBe(result.asyncFolderPath);
      }

      expect(results.map((result) => result.syncFolderPath)).toEqual([
        '/',
        't357-attachment-path-sync/files',
        't357-attachment-path-sync/docs',
        't357-attachment-path-sync/docs/assets'
      ]);
    });
  });

  describe('getAvailablePathForAttachments', () => {
    it('should return a valid path for a new attachment', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        // eslint-disable-next-line unicorn/name-replacements -- `fn` is declared by `obsidian-integration-testing`; renaming it here would not match the API.
        fn({ app, lib: { getAvailablePathForAttachments } }) {
          return getAvailablePathForAttachments({
            app,
            attachmentFileBaseName: 'test-image',
            attachmentFileExtension: 'png',
            notePathOrFile: null,
            shouldSkipDuplicateCheck: true,
            shouldSkipMissingAttachmentFolderCreation: true
          });
        }
      });

      expect(result).toContain('test-image');
      expect(result).toContain('.png');
    });

    it('should generate unique paths when duplicates exist', async () => {
      const result = await evalInObsidian<Record<string, never>, string[]>({
        // eslint-disable-next-line unicorn/name-replacements -- `fn` is declared by `obsidian-integration-testing`; renaming it here would not match the API.
        fn({ app, lib: { getAvailablePathForAttachments } }) {
          function getPath(): Promise<string> {
            return getAvailablePathForAttachments({
              app,
              attachmentFileBaseName: 'unique-test',
              attachmentFileExtension: 'txt',
              notePathOrFile: null,
              shouldSkipMissingAttachmentFolderCreation: true
            });
          }

          return Promise.all([getPath(), getPath()]);
        }
      });

      expect(result).toHaveLength(2);
      for (const path of result) {
        expect(path).toContain('unique-test');
      }
    });
  });

  describe('hasOwnAttachmentFolder', () => {
    it('should return a boolean indicating own attachment folder', async () => {
      const hasOwnFolder = await evalInObsidian<Record<string, never>, boolean>({
        // eslint-disable-next-line unicorn/name-replacements -- `fn` is declared by `obsidian-integration-testing`; renaming it here would not match the API.
        fn({ app, lib: { hasOwnAttachmentFolder } }) {
          return hasOwnAttachmentFolder({ app, path: 'test-note.md' });
        }
      });

      expect(typeof hasOwnFolder).toBe('boolean');
    });
  });
});
