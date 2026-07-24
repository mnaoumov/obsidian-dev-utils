// @vitest-environment jsdom

import type { App as AppOriginal } from 'obsidian';
import type { Mock } from 'vitest';

import { getDataAdapterEx } from '@obsidian-typings/obsidian-public-latest/implementations';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from '../object-utils.ts';
import {
  AttachmentPathContext,
  isAtProperAttachmentPath
} from './attachment-path.ts';

describe('isAtProperAttachmentPath', () => {
  let app: AppOriginal;

  beforeEach(() => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    getDataAdapterEx(app).insensitive = false;
  });

  function stubProperPath(properPath: string): Mock {
    const extended = vi.fn().mockResolvedValue(properPath);
    app.vault.getAvailablePathForAttachments = castTo<typeof app.vault.getAvailablePathForAttachments>(
      Object.assign(vi.fn(), { extended })
    );
    return extended;
  }

  async function check(attachmentPath: string, properPath: string): Promise<boolean> {
    stubProperPath(properPath);
    return await isAtProperAttachmentPath({
      app,
      attachmentPathOrFile: attachmentPath,
      notePathOrFile: 'note.md'
    });
  }

  it('should return true for an attachment parked with an Obsidian deduplication suffix', async () => {
    expect(await check('attachments/img 1.png', 'attachments/img.png')).toBe(true);
    expect(await check('attachments/img 23.png', 'attachments/img.png')).toBe(true);
  });

  it('should return true for an attachment already at the exact proper path', async () => {
    expect(await check('attachments/img.png', 'attachments/img.png')).toBe(true);
  });

  it('should return false for an attachment in the wrong folder', async () => {
    expect(await check('other/img.png', 'attachments/img.png')).toBe(false);
  });

  describe('case-variant folder', () => {
    it('should return true on a case-insensitive file system', async () => {
      getDataAdapterEx(app).insensitive = true;
      expect(await check('Attachments/img.png', 'attachments/img.png')).toBe(true);
    });

    it('should return false on a case-sensitive file system', async () => {
      getDataAdapterEx(app).insensitive = false;
      expect(await check('Attachments/img.png', 'attachments/img.png')).toBe(false);
    });
  });

  it('should reject deduplication-suffix look-alike names', async () => {
    expect(await check('attachments/img-1.png', 'attachments/img.png')).toBe(false); // Hyphen, not a space separator.
    expect(await check('attachments/imgX.png', 'attachments/img.png')).toBe(false); // No separator at all.
    expect(await check('attachments/img .png', 'attachments/img.png')).toBe(false); // Trailing space, empty suffix.
    expect(await check('attachments/img abc.png', 'attachments/img.png')).toBe(false); // Non-numeric suffix.
    expect(await check('attachments/img.pdf', 'attachments/img.png')).toBe(false); // Different extension.
  });

  it('should forward the note, attachment, and explicit context to the proper-path lookup', async () => {
    const extended = stubProperPath('attachments/img.png');
    const result = await isAtProperAttachmentPath({
      app,
      attachmentPathOrFile: 'attachments/img 1.png',
      context: AttachmentPathContext.RenameNote,
      notePathOrFile: 'note.md'
    });
    expect(result).toBe(true);
    expect(extended).toHaveBeenCalledTimes(1);
    expect(extended).toHaveBeenCalledWith(expect.objectContaining({
      context: AttachmentPathContext.RenameNote,
      notePathOrFile: 'note.md',
      oldAttachmentPathOrFile: 'attachments/img 1.png',
      shouldSkipDuplicateCheck: true
    }));
  });
});
