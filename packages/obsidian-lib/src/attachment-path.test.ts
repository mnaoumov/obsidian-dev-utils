// @vitest-environment jsdom

import type { App as AppOriginal } from 'obsidian';
import type { Mock } from 'vitest';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import {
  basename,
  dirname,
  extname
} from '@mnaoumov/typescript-lib/path';
import { getDataAdapterEx } from '@obsidian-typings/obsidian-public-latest/implementations';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GetAvailablePathForAttachmentsExtendedFunctionParams } from './attachment-path.ts';

import {
  AttachmentPathContext,
  CUSTOM_ATTACHMENT_LOCATION_PLUGIN_ID,
  getAttachmentFilePath,
  getAttachmentFolderPath,
  getAttachmentFolderPathSyncOrNull,
  getAvailablePathForAttachments,
  getCheckIsAttachmentUnitFolderFunction,
  hasOwnAttachmentFolder,
  isAtProperAttachmentPath
} from './attachment-path.ts';
import { getFile } from './file-system.ts';
import { findPluginApi } from './plugin/plugin-api.ts';

interface IsAttachmentUnitFolderParams {
  readonly folderPath: string;
}

vi.mock('./plugin/plugin-api.ts', () => ({
  findPluginApi: vi.fn(() => null)
}));

const NOTE_PATH = 'Docs/note.md';

const mockedFindPluginApi = vi.mocked(findPluginApi);

beforeEach(() => {
  mockedFindPluginApi.mockReset();
  mockedFindPluginApi.mockReturnValue(null);
});

function createApp(attachmentFolderPath: string, extraFiles?: Record<string, string>): AppOriginal {
  const app = App.createConfigured__({
    files: {
      'Docs/note.md': '',
      'Docs/other.md': '',
      'Files/': '',
      'Files/Sub/': '',
      'root-note.md': '',
      ...extraFiles
    }
  }).asOriginalType__();
  app.vault.setConfig('attachmentFolderPath', attachmentFolderPath);
  return app;
}

/**
 * Models Custom Attachment Location publishing its attachment-path API through the registry.
 */
function stubCustomAttachmentLocationApi(api: Partial<Record<'getAvailablePathForAttachments' | 'isAttachmentUnitFolder', Mock>>): void {
  mockedFindPluginApi.mockReturnValue({
    getAvailablePathForAttachments: vi.fn(),
    isAttachmentUnitFolder: vi.fn(() => false),
    ...api
  });
}

/**
 * Models what Custom Attachment Location does: derive the attachment folder from the note's NAME.
 */
function stubNoteNameFolder(): void {
  const getAvailablePathForAttachmentsFromApi = vi.fn((params: GetAvailablePathForAttachmentsExtendedFunctionParams): Promise<string> => {
    const notePath = params.notePathOrFile as string;
    const noteFolderPath = dirname(notePath);
    const noteBaseName = basename(notePath, extname(notePath));
    const attachmentFileExtension = params.attachmentFileExtension ? `.${params.attachmentFileExtension}` : '';
    return Promise.resolve(`${noteFolderPath}/${noteBaseName}/${params.attachmentFileBaseName}${attachmentFileExtension}`);
  });
  stubCustomAttachmentLocationApi({ getAvailablePathForAttachments: getAvailablePathForAttachmentsFromApi });
}

describe('getAttachmentFolderPath', () => {
  it('should resolve the vault root', async () => {
    const app = createApp('/');
    expect(await getAttachmentFolderPath({ app, notePathOrFile: NOTE_PATH })).toBe('/');
  });

  it('should resolve a fixed folder', async () => {
    const app = createApp('Files');
    expect(await getAttachmentFolderPath({ app, notePathOrFile: NOTE_PATH })).toBe('Files');
  });

  it('should resolve a fixed folder that does not exist yet', async () => {
    const app = createApp('Missing');
    expect(await getAttachmentFolderPath({ app, notePathOrFile: NOTE_PATH })).toBe('Missing');
  });

  it('should resolve the note folder', async () => {
    const app = createApp('./');
    expect(await getAttachmentFolderPath({ app, notePathOrFile: NOTE_PATH })).toBe('Docs');
  });

  it('should resolve the note folder for the dot setting variant', async () => {
    const app = createApp('.');
    expect(await getAttachmentFolderPath({ app, notePathOrFile: NOTE_PATH })).toBe('Docs');
  });

  it('should resolve a subfolder of the note folder', async () => {
    const app = createApp('./assets');
    expect(await getAttachmentFolderPath({ app, notePathOrFile: NOTE_PATH })).toBe('Docs/assets');
  });

  it('should resolve the note folder for a note that does not exist yet', async () => {
    const app = createApp('./');
    expect(await getAttachmentFolderPath({ app, notePathOrFile: 'Docs/missing.md' })).toBe('Docs');
    expect(await getAttachmentFolderPath({ app, notePathOrFile: 'Missing/missing.md' })).toBe('Missing');
  });

  it('should resolve a subfolder of the folder of a note that does not exist yet', async () => {
    const app = createApp('./assets');
    expect(await getAttachmentFolderPath({ app, notePathOrFile: 'Docs/missing.md' })).toBe('Docs/assets');
  });

  it('should normalize a setting with redundant and backslash separators', async () => {
    const app = createApp('\\Files\\\\Sub\\');
    expect(await getAttachmentFolderPath({ app, notePathOrFile: NOTE_PATH })).toBe('Files/Sub');
  });

  it('should fall back to the vault root for a note detached from the folder tree', async () => {
    const app = createApp('./');
    const note = getFile({ app, pathOrFile: NOTE_PATH });
    note.parent = null;
    expect(await getAttachmentFolderPath({ app, notePathOrFile: note })).toBe('/');
  });

  it('should fall back to a root subfolder for a note detached from the folder tree', async () => {
    const app = createApp('./assets');
    const note = getFile({ app, pathOrFile: NOTE_PATH });
    note.parent = null;
    expect(await getAttachmentFolderPath({ app, notePathOrFile: note })).toBe('assets');
  });

  it('should honor an explicit context', async () => {
    const app = createApp('./');
    expect(
      await getAttachmentFolderPath({
        app,
        context: AttachmentPathContext.RenameNote,
        notePathOrFile: NOTE_PATH
      })
    ).toBe('Docs');
  });
});

describe('getAttachmentFolderPathSyncOrNull', () => {
  it.each([
    ['/', NOTE_PATH, '/'],
    ['Files', NOTE_PATH, 'Files'],
    ['Missing', NOTE_PATH, 'Missing'],
    ['./', NOTE_PATH, 'Docs'],
    ['.', NOTE_PATH, 'Docs'],
    ['./assets', NOTE_PATH, 'Docs/assets'],
    ['./', 'Docs/missing.md', 'Docs'],
    ['./', 'Missing/missing.md', 'Missing'],
    ['./assets', 'Docs/missing.md', 'Docs/assets'],
    ['\\Files\\\\Sub\\', NOTE_PATH, 'Files/Sub']
  ])('should resolve the %j setting exactly as the async twin does', async (attachmentFolderPath, notePathOrFile, expectedFolderPath) => {
    const app = createApp(attachmentFolderPath);
    const syncFolderPath = getAttachmentFolderPathSyncOrNull({ app, notePathOrFile });
    expect(syncFolderPath).toBe(expectedFolderPath);
    expect(syncFolderPath).toBe(await getAttachmentFolderPath({ app, notePathOrFile }));
  });

  it('should fall back to the vault root for a note detached from the folder tree', async () => {
    const app = createApp('./');
    const note = getFile({ app, pathOrFile: NOTE_PATH });
    note.parent = null;
    const syncFolderPath = getAttachmentFolderPathSyncOrNull({ app, notePathOrFile: note });
    expect(syncFolderPath).toBe('/');
    expect(syncFolderPath).toBe(await getAttachmentFolderPath({ app, notePathOrFile: note }));
  });

  it('should fall back to a root subfolder for a note detached from the folder tree', async () => {
    const app = createApp('./assets');
    const note = getFile({ app, pathOrFile: NOTE_PATH });
    note.parent = null;
    const syncFolderPath = getAttachmentFolderPathSyncOrNull({ app, notePathOrFile: note });
    expect(syncFolderPath).toBe('assets');
    expect(syncFolderPath).toBe(await getAttachmentFolderPath({ app, notePathOrFile: note }));
  });

  it('should return null when Custom Attachment Location owns the resolution', () => {
    const app = createApp('./');
    stubNoteNameFolder();
    expect(getAttachmentFolderPathSyncOrNull({ app, notePathOrFile: NOTE_PATH })).toBeNull();
  });
});

describe('getAvailablePathForAttachments', () => {
  it('should resolve the vault root for a note-less attachment', async () => {
    const app = createApp('./');
    expect(
      await getAvailablePathForAttachments({
        app,
        attachmentFileBaseName: 'img',
        attachmentFileExtension: 'png',
        notePathOrFile: null,
        shouldSkipDuplicateCheck: true,
        shouldSkipMissingAttachmentFolderCreation: true
      })
    ).toBe('img.png');
  });

  it('should resolve a root subfolder for a note-less attachment', async () => {
    const app = createApp('./assets');
    expect(
      await getAvailablePathForAttachments({
        app,
        attachmentFileBaseName: 'img',
        attachmentFileExtension: 'png',
        notePathOrFile: null,
        shouldSkipDuplicateCheck: true,
        shouldSkipMissingAttachmentFolderCreation: true
      })
    ).toBe('assets/img.png');
  });

  it('should create a missing attachment folder', async () => {
    const app = createApp('./assets');
    expect(app.vault.getFolderByPath('Docs/assets')).toBeNull();
    expect(
      await getAvailablePathForAttachments({
        app,
        attachmentFileBaseName: 'img',
        attachmentFileExtension: 'png',
        notePathOrFile: NOTE_PATH,
        shouldSkipDuplicateCheck: true,
        shouldSkipMissingAttachmentFolderCreation: false
      })
    ).toBe('Docs/assets/img.png');
    expect(app.vault.getFolderByPath('Docs/assets')).not.toBeNull();
  });

  it('should not create a missing attachment folder when skipped', async () => {
    const app = createApp('./assets');
    expect(
      await getAvailablePathForAttachments({
        app,
        attachmentFileBaseName: 'img',
        attachmentFileExtension: 'png',
        notePathOrFile: NOTE_PATH,
        shouldSkipDuplicateCheck: true,
        shouldSkipMissingAttachmentFolderCreation: true
      })
    ).toBe('Docs/assets/img.png');
    expect(app.vault.getFolderByPath('Docs/assets')).toBeNull();
  });

  it('should deduplicate against an existing attachment', async () => {
    const app = createApp('./', { 'Docs/img.png': '' });
    expect(
      await getAvailablePathForAttachments({
        app,
        attachmentFileBaseName: 'img',
        attachmentFileExtension: 'png',
        notePathOrFile: NOTE_PATH
      })
    ).toBe('Docs/img 1.png');
  });

  it('should keep the requested name when the duplicate check is skipped', async () => {
    const app = createApp('./', { 'Docs/img.png': '' });
    expect(
      await getAvailablePathForAttachments({
        app,
        attachmentFileBaseName: 'img',
        attachmentFileExtension: 'png',
        notePathOrFile: NOTE_PATH,
        shouldSkipDuplicateCheck: true
      })
    ).toBe('Docs/img.png');
  });
});

describe('getAttachmentFilePath', () => {
  it('should resolve the attachment path when Custom Attachment Location publishes no API', async () => {
    const app = createApp('./assets');
    expect(
      await getAttachmentFilePath({
        app,
        context: AttachmentPathContext.Unknown,
        notePathOrFile: NOTE_PATH,
        oldAttachmentPathOrFile: 'Inbox/img.png',
        shouldSkipDuplicateCheck: true
      })
    ).toBe('Docs/assets/img.png');
  });

  it('should pass the stats and a content reader of an existing attachment to the Custom Attachment Location resolver', async () => {
    const app = createApp('./', { 'Inbox/img.png': 'CONTENT' });
    const extended = vi.fn().mockResolvedValue('Docs/img.png');
    stubCustomAttachmentLocationApi({ getAvailablePathForAttachments: extended });
    const content = new ArrayBuffer(8);
    const readBinary = vi.fn().mockResolvedValue(content);
    app.vault.readBinary = readBinary;

    expect(
      await getAttachmentFilePath({
        app,
        context: AttachmentPathContext.RenameNote,
        notePathOrFile: NOTE_PATH,
        oldAttachmentPathOrFile: 'Inbox/img.png',
        oldNotePathOrFile: 'Docs/old-note.md',
        shouldSkipDuplicateCheck: true
      })
    ).toBe('Docs/img.png');

    const params = castTo<GetAvailablePathForAttachmentsExtendedFunctionParams>(extended.mock.calls[0]?.[0]);
    expect(params.attachmentFileBaseName).toBe('img');
    expect(params.attachmentFileExtension).toBe('png');
    expect(params.attachmentFileStats).toBeDefined();
    expect(params.oldNotePathOrFile).toBe('Docs/old-note.md');
    expect(params.readAttachmentFileContent).not.toBeNull();
    expect(await params.readAttachmentFileContent?.()).toBe(content);
    expect(readBinary).toHaveBeenCalledWith(expect.objectContaining({ path: 'Inbox/img.png' }));
  });

  it('should pass no content reader for a missing attachment', async () => {
    const app = createApp('./');
    const extended = vi.fn().mockResolvedValue('Docs/img.png');
    stubCustomAttachmentLocationApi({ getAvailablePathForAttachments: extended });

    await getAttachmentFilePath({
      app,
      context: AttachmentPathContext.Unknown,
      notePathOrFile: NOTE_PATH,
      oldAttachmentPathOrFile: 'Inbox/missing.png',
      shouldSkipDuplicateCheck: true
    });

    const params = castTo<GetAvailablePathForAttachmentsExtendedFunctionParams>(extended.mock.calls[0]?.[0]);
    expect(params.attachmentFileStats).toBeUndefined();
    expect(params.readAttachmentFileContent).toBeNull();
  });
});

describe('hasOwnAttachmentFolder', () => {
  it('should return false for the vault root', async () => {
    const app = createApp('/');
    expect(await hasOwnAttachmentFolder({ app, path: NOTE_PATH })).toBe(false);
  });

  it('should return false for a fixed folder', async () => {
    const app = createApp('Files');
    expect(await hasOwnAttachmentFolder({ app, path: NOTE_PATH })).toBe(false);
  });

  it('should return false for the note folder', async () => {
    const app = createApp('./');
    expect(await hasOwnAttachmentFolder({ app, path: NOTE_PATH })).toBe(false);
  });

  it('should return false for a subfolder of the note folder', async () => {
    const app = createApp('./assets');
    expect(await hasOwnAttachmentFolder({ app, path: NOTE_PATH })).toBe(false);
  });

  it('should return true when the folder is derived from the note name', async () => {
    const app = createApp('./');
    stubNoteNameFolder();
    expect(
      await hasOwnAttachmentFolder({
        app,
        context: AttachmentPathContext.DeleteNote,
        path: NOTE_PATH
      })
    ).toBe(true);
  });
});

describe('isAtProperAttachmentPath', () => {
  let app: AppOriginal;

  beforeEach(() => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    getDataAdapterEx(app).insensitive = false;
  });

  function stubProperPath(properPath: string): Mock {
    const extended = vi.fn().mockResolvedValue(properPath);
    stubCustomAttachmentLocationApi({ getAvailablePathForAttachments: extended });
    return extended;
  }

  async function isAtProperAttachmentPathImpl(attachmentPath: string, properPath: string): Promise<boolean> {
    stubProperPath(properPath);
    return await isAtProperAttachmentPath({
      app,
      attachmentPathOrFile: attachmentPath,
      notePathOrFile: 'note.md'
    });
  }

  it('should return true for an attachment parked with an Obsidian deduplication suffix', async () => {
    expect(await isAtProperAttachmentPathImpl('attachments/img 1.png', 'attachments/img.png')).toBe(true);
    expect(await isAtProperAttachmentPathImpl('attachments/img 23.png', 'attachments/img.png')).toBe(true);
  });

  it('should return true for an attachment already at the exact proper path', async () => {
    expect(await isAtProperAttachmentPathImpl('attachments/img.png', 'attachments/img.png')).toBe(true);
  });

  it('should return false for an attachment in the wrong folder', async () => {
    expect(await isAtProperAttachmentPathImpl('other/img.png', 'attachments/img.png')).toBe(false);
  });

  describe('case-variant folder', () => {
    it('should return true on a case-insensitive file system', async () => {
      getDataAdapterEx(app).insensitive = true;
      expect(await isAtProperAttachmentPathImpl('Attachments/img.png', 'attachments/img.png')).toBe(true);
    });

    it('should return false on a case-sensitive file system', async () => {
      getDataAdapterEx(app).insensitive = false;
      expect(await isAtProperAttachmentPathImpl('Attachments/img.png', 'attachments/img.png')).toBe(false);
    });
  });

  it('should reject deduplication-suffix look-alike names', async () => {
    expect(await isAtProperAttachmentPathImpl('attachments/img-1.png', 'attachments/img.png')).toBe(false); // Hyphen, not a space separator.
    expect(await isAtProperAttachmentPathImpl('attachments/imgX.png', 'attachments/img.png')).toBe(false); // No separator at all.
    expect(await isAtProperAttachmentPathImpl('attachments/img .png', 'attachments/img.png')).toBe(false); // Trailing space, empty suffix.
    expect(await isAtProperAttachmentPathImpl('attachments/img abc.png', 'attachments/img.png')).toBe(false); // Non-numeric suffix.
    expect(await isAtProperAttachmentPathImpl('attachments/img.pdf', 'attachments/img.png')).toBe(false); // Different extension.
  });

  it('should forward the note, attachment, and explicit context to the proper-path lookup', async () => {
    const extended = stubProperPath('attachments/img.png');
    const isAtProperPath = await isAtProperAttachmentPath({
      app,
      attachmentPathOrFile: 'attachments/img 1.png',
      context: AttachmentPathContext.RenameNote,
      notePathOrFile: 'note.md'
    });
    expect(isAtProperPath).toBe(true);
    expect(extended).toHaveBeenCalledTimes(1);
    expect(extended).toHaveBeenCalledWith(expect.objectContaining({
      context: AttachmentPathContext.RenameNote,
      notePathOrFile: 'note.md',
      oldAttachmentPathOrFile: 'attachments/img 1.png',
      shouldSkipDuplicateCheck: true
    }));
  });
});

describe('getCheckIsAttachmentUnitFolderFunction', () => {
  it('should read the designation Custom Attachment Location publishes through its API', () => {
    const isAttachmentUnitFolder = vi.fn((params: IsAttachmentUnitFolderParams) => params.folderPath === 'notes/page_files');
    stubCustomAttachmentLocationApi({ isAttachmentUnitFolder });
    const checkIsAttachmentUnitFolder = getCheckIsAttachmentUnitFolderFunction(createApp('Files'));
    expect(checkIsAttachmentUnitFolder?.('notes/page_files')).toBe(true);
    expect(checkIsAttachmentUnitFolder?.('notes/assets')).toBe(false);
    expect(isAttachmentUnitFolder).toHaveBeenCalledWith({ folderPath: 'notes/page_files' });
  });

  it('should answer undefined when nobody published a designation', () => {
    // Absent is the same "nobody owns this policy" answer that sends the path lookup to Obsidian's own resolution.
    expect(getCheckIsAttachmentUnitFolderFunction(createApp('Files'))).toBeUndefined();
  });
});

describe('Custom Attachment Location lookup', () => {
  it('should ask the registry for the plugin id, contract range and both members', () => {
    getAttachmentFolderPathSyncOrNull({ app: createApp('./'), notePathOrFile: NOTE_PATH });
    expect(mockedFindPluginApi).toHaveBeenCalledWith({
      apiVersionRange: '^1.3.0',
      contract: { getAvailablePathForAttachments: {}, isAttachmentUnitFolder: {} },
      pluginId: CUSTOM_ATTACHMENT_LOCATION_PLUGIN_ID
    });
  });
});
