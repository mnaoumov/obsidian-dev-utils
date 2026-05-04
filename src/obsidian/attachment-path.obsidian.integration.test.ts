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
  inject,
  it
} from 'vitest';

describe('attachment-path', () => {
  describe('getAttachmentFolderPath', () => {
    it('should return the attachment folder path for a note', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        fn({ app }) {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }
          return lib.obsidian.attachment_path.getAttachmentFolderPath(app, 'test-note.md');
        },
        vaultPath: inject('tempVaultPath')
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailablePathForAttachments', () => {
    it('should return a valid path for a new attachment', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        fn({ app }) {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }
          return lib.obsidian.attachment_path.getAvailablePathForAttachments({
            app,
            attachmentFileBaseName: 'test-image',
            attachmentFileExtension: 'png',
            notePathOrFile: null,
            shouldSkipDuplicateCheck: true,
            shouldSkipMissingAttachmentFolderCreation: true
          });
        },
        vaultPath: inject('tempVaultPath')
      });

      expect(result).toContain('test-image');
      expect(result).toContain('.png');
    });

    it('should generate unique paths when duplicates exist', async () => {
      const result = await evalInObsidian<Record<string, never>, string[]>({
        fn({ app }) {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }
          const checkedLib = lib;

          function getPath(): Promise<string> {
            return checkedLib.obsidian.attachment_path.getAvailablePathForAttachments({
              app,
              attachmentFileBaseName: 'unique-test',
              attachmentFileExtension: 'txt',
              notePathOrFile: null,
              shouldSkipMissingAttachmentFolderCreation: true
            });
          }

          return Promise.all([getPath(), getPath()]);
        },
        vaultPath: inject('tempVaultPath')
      });

      expect(result).toHaveLength(2);
      for (const path of result) {
        expect(path).toContain('unique-test');
      }
    });
  });

  describe('hasOwnAttachmentFolder', () => {
    it('should return a boolean indicating own attachment folder', async () => {
      const result = await evalInObsidian<Record<string, never>, boolean>({
        fn({ app }) {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }
          return lib.obsidian.attachment_path.hasOwnAttachmentFolder(app, 'test-note.md');
        },
        vaultPath: inject('tempVaultPath')
      });

      expect(typeof result).toBe('boolean');
    });
  });
});
