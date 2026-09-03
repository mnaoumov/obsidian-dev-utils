// @vitest-environment jsdom

import type { App as AppOriginal } from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from '../object-utils.ts';
import {
  findAttachmentUnitFolderPath,
  rebasePathOntoFolder
} from './attachment-unit-folder.ts';

/**
 * Models an attachment-location plugin publishing its designation on the patched vault method.
 */
function createApp(checkIsAttachmentUnitFolder?: (folderPath: string) => boolean): AppOriginal {
  const app = App.createConfigured__().asOriginalType__();
  if (checkIsAttachmentUnitFolder) {
    app.vault.getAvailablePathForAttachments = castTo<typeof app.vault.getAvailablePathForAttachments>(
      Object.assign(vi.fn(), { checkIsAttachmentUnitFolder })
    );
  }

  return app;
}

function matching(...unitFolderPaths: string[]): (folderPath: string) => boolean {
  return (folderPath) => unitFolderPaths.includes(folderPath);
}

describe('findAttachmentUnitFolderPath', () => {
  it('should find the folder an attachment sits directly in', () => {
    expect(findAttachmentUnitFolderPath({
      attachmentPath: 'notes/page_files/style.css',
      checkIsAttachmentUnitFolder: matching('notes/page_files')
    })).toBe('notes/page_files');
  });

  it('should find the folder an attachment sits several levels below', () => {
    expect(findAttachmentUnitFolderPath({
      attachmentPath: 'notes/page_files/img/deep/logo.png',
      checkIsAttachmentUnitFolder: matching('notes/page_files')
    })).toBe('notes/page_files');
  });

  it('should return the outermost designated ancestor, not the nearest one', () => {
    // Moving the nearest would tear the outer tree in half, which is the failure the whole feature
    // Exists to prevent.
    expect(findAttachmentUnitFolderPath({
      attachmentPath: 'notes/page_files/img/logo.png',
      checkIsAttachmentUnitFolder: matching('notes/page_files', 'notes/page_files/img')
    })).toBe('notes/page_files');
  });

  it('should return null when no ancestor is designated', () => {
    expect(findAttachmentUnitFolderPath({
      attachmentPath: 'notes/assets/logo.png',
      checkIsAttachmentUnitFolder: matching('notes/page_files')
    })).toBeNull();
  });

  it('should return null when nothing at all is designated', () => {
    expect(findAttachmentUnitFolderPath({
      attachmentPath: 'notes/page_files/logo.png',
      checkIsAttachmentUnitFolder: () => false
    })).toBeNull();
  });

  it('should never treat the vault root as a unit', () => {
    // A root unit would make every collection either a no-op or a vault-wide move.
    expect(findAttachmentUnitFolderPath({
      attachmentPath: 'logo.png',
      checkIsAttachmentUnitFolder: () => true
    })).toBeNull();
  });

  it('should not match the attachment file itself, only its ancestors', () => {
    expect(findAttachmentUnitFolderPath({
      attachmentPath: 'notes/logo.png',
      checkIsAttachmentUnitFolder: matching('notes/logo.png')
    })).toBeNull();
  });

  it('should match a top-level folder', () => {
    expect(findAttachmentUnitFolderPath({
      attachmentPath: 'page_files/img/logo.png',
      checkIsAttachmentUnitFolder: matching('page_files')
    })).toBe('page_files');
  });
});

describe('findAttachmentUnitFolderPath with the published designation', () => {
  it('should walk with the designation an attachment-location plugin published', () => {
    const app = createApp(matching('notes/page_files'));
    expect(findAttachmentUnitFolderPath({
      app,
      attachmentPath: 'notes/page_files/style.css'
    })).toBe('notes/page_files');
  });

  it('should return the outermost designated ancestor', () => {
    const app = createApp(matching('notes/page_files', 'notes/page_files/img'));
    expect(findAttachmentUnitFolderPath({
      app,
      attachmentPath: 'notes/page_files/img/logo.png'
    })).toBe('notes/page_files');
  });

  it('should return null when the published designation matches no ancestor', () => {
    const app = createApp(matching('notes/page_files'));
    expect(findAttachmentUnitFolderPath({
      app,
      attachmentPath: 'notes/assets/logo.png'
    })).toBeNull();
  });

  it('should return null when nobody published a designation', () => {
    // Absent is not the same as a designation answering `false` — it means no plugin owns the policy.
    const app = createApp();
    expect(findAttachmentUnitFolderPath({
      app,
      attachmentPath: 'notes/page_files/style.css'
    })).toBeNull();
  });

  it('should never treat the vault root as a unit', () => {
    const app = createApp(() => true);
    expect(findAttachmentUnitFolderPath({
      app,
      attachmentPath: 'logo.png'
    })).toBeNull();
  });
});

describe('rebasePathOntoFolder', () => {
  it('should rebase a direct child', () => {
    expect(rebasePathOntoFolder({
      newFolderPath: 'assets/note/page_files',
      oldFolderPath: 'old/page_files',
      path: 'old/page_files/style.css'
    })).toBe('assets/note/page_files/style.css');
  });

  it('should keep the shape of a deeply nested child', () => {
    expect(rebasePathOntoFolder({
      newFolderPath: 'assets/note/page_files',
      oldFolderPath: 'old/page_files',
      path: 'old/page_files/img/deep/logo.png'
    })).toBe('assets/note/page_files/img/deep/logo.png');
  });

  it('should return null for a path outside the folder', () => {
    expect(rebasePathOntoFolder({
      newFolderPath: 'assets/note/page_files',
      oldFolderPath: 'old/page_files',
      path: 'old/other/logo.png'
    })).toBeNull();
  });

  it('should return null for the folder itself', () => {
    expect(rebasePathOntoFolder({
      newFolderPath: 'assets/note/page_files',
      oldFolderPath: 'old/page_files',
      path: 'old/page_files'
    })).toBeNull();
  });

  it('should not treat a sibling with the same prefix as a child', () => {
    expect(rebasePathOntoFolder({
      newFolderPath: 'assets/note/page_files',
      oldFolderPath: 'old/page_files',
      path: 'old/page_files_backup/logo.png'
    })).toBeNull();
  });
});
