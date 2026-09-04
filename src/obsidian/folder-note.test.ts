import type {
  App as AppOriginal,
  Plugin as PluginOriginal,
  TFolder
} from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { FolderNoteConfig } from './folder-note.ts';

import { castTo } from '../object-utils.ts';
import { ensureNonNullable } from '../type-guards.ts';
import {
  FOLDER_NOTES_PLUGIN_ID,
  FolderNoteLocation,
  resolveFolderNote,
  resolveFolderNoteConfig
} from './folder-note.ts';

const DEFAULT_FILES = { 'alpha/bravo/charlie/charlie.md': '' };

let app: AppOriginal;
// Kept alongside `app` because `registerPlugin__` is a mock-only seam: `asOriginalType__()` hands back the
// Same object typed as Obsidian's `App`, whose `plugins` does not declare it.
let appMock: App;

/**
 * Resolves a config against a vault that has the folder-notes plugin configured as given.
 *
 * @param folderNotesSettings - That plugin's private settings, or `undefined` for "not installed".
 * @returns The resolved config.
 */
function autoConfigFor(folderNotesSettings?: unknown): FolderNoteConfig {
  initApp(DEFAULT_FILES, folderNotesSettings);
  return resolveFolderNoteConfig({ app });
}

function getFolder(path: string): TFolder {
  return ensureNonNullable(app.vault.getFolderByPath(path));
}

/**
 * Builds an app whose vault holds the given files, and whose plugin registry holds a `folder-notes` with
 * the given settings.
 *
 * @param files - The vault's files.
 * @param folderNotesSettings - That plugin's private settings, or `undefined` for "not installed".
 */
function initApp(files: Record<string, string>, folderNotesSettings?: unknown): void {
  appMock = App.createConfigured__({ files });
  if (folderNotesSettings !== undefined) {
    // The registry is typed to return a `Plugin` and every shape under test is deliberately NOT one —
    // That is the point, since these are another plugin's private settings.
    appMock.plugins.registerPlugin__(FOLDER_NOTES_PLUGIN_ID, castTo<PluginOriginal>({ settings: folderNotesSettings }));
  }
  app = appMock.asOriginalType__();
}

/**
 * Names the folder the fixtures use, through a resolved config.
 *
 * @param config - The config to name through.
 * @param folderPath - The folder's path.
 * @returns The resolved name.
 */
function resolveNameOf(config: FolderNoteConfig, folderPath = 'alpha/bravo/charlie'): string {
  return config.resolveName(getFolder(folderPath));
}

describe('resolveFolderNoteConfig', () => {
  describe('an explicit setup', () => {
    it('should be taken as given, defaulting to a Markdown note named after its folder', () => {
      initApp(DEFAULT_FILES);
      const config = resolveFolderNoteConfig({ app, location: FolderNoteLocation.InsideFolder });
      expect(config.extensions).toEqual(['md']);
      expect(config.isHidden).toBe(false);
      expect(config.location).toBe(FolderNoteLocation.InsideFolder);
      expect(resolveNameOf(config)).toBe('charlie');
    });

    it('should keep the caller\'s own naming, hiding and extensions', () => {
      initApp(DEFAULT_FILES);
      const config = resolveFolderNoteConfig({
        app,
        extensions: ['.CANVAS', 'md'],
        isHidden: true,
        location: FolderNoteLocation.ParentFolder,
        resolveName: () => 'index'
      });
      expect(config.extensions).toEqual(['canvas', 'md']);
      expect(config.isHidden).toBe(true);
      expect(config.location).toBe(FolderNoteLocation.ParentFolder);
      expect(resolveNameOf(config)).toBe('index');
    });

    it('should normalize extensions the way the folder-notes plugin does', () => {
      initApp(DEFAULT_FILES);
      expect(
        resolveFolderNoteConfig({
          app,
          extensions: [' .Excalidraw ', 'md', '', 'canvas', '.canvas'],
          location: FolderNoteLocation.InsideFolder
        }).extensions
      ).toEqual(['md', 'canvas']);
    });

    it('should ignore the installed plugin entirely', () => {
      initApp(DEFAULT_FILES, { folderNoteName: 'index', storageLocation: 'parentFolder' });
      const config = resolveFolderNoteConfig({ app, location: FolderNoteLocation.InsideFolder });
      expect(config.location).toBe(FolderNoteLocation.InsideFolder);
      expect(resolveNameOf(config)).toBe('charlie');
    });

    it('should report None as itself, so the caller resolves no note at all', () => {
      initApp(DEFAULT_FILES);
      expect(resolveFolderNoteConfig({ app, location: FolderNoteLocation.None }).location).toBe(FolderNoteLocation.None);
    });
  });

  describe('Auto', () => {
    it('should fall back to a Markdown note named after its folder, inside it, when the plugin is absent', () => {
      const config = autoConfigFor();
      expect(config.extensions).toEqual(['md']);
      expect(config.isHidden).toBe(false);
      expect(config.location).toBe(FolderNoteLocation.InsideFolder);
      expect(resolveNameOf(config)).toBe('charlie');
    });

    it('should be what an omitted location means', () => {
      initApp(DEFAULT_FILES, { folderNoteName: 'index', storageLocation: 'parentFolder' });
      expect(resolveFolderNoteConfig({ app }).location).toBe(FolderNoteLocation.ParentFolder);
    });

    it('should read the installed plugin, translating its own token', () => {
      const config = autoConfigFor({ folderNoteName: '{{folder_name}}', storageLocation: 'insideFolder' });
      expect(config.location).toBe(FolderNoteLocation.InsideFolder);
      expect(resolveNameOf(config)).toBe('charlie');
    });

    it('should read a fixed folder-note name from the installed plugin', () => {
      expect(resolveNameOf(autoConfigFor({ folderNoteName: 'index', storageLocation: 'insideFolder' }))).toBe('index');
    });

    it('should insert the folder name literally, never as a replacement pattern', () => {
      initApp({ 'alpha/$&/note.md': '' }, { folderNoteName: '{{folder_name}} note', storageLocation: 'insideFolder' });
      expect(resolveNameOf(resolveFolderNoteConfig({ app }), 'alpha/$&')).toBe('$& note');
    });

    it('should read the outside-the-folder location from the installed plugin', () => {
      expect(autoConfigFor({ folderNoteName: '{{folder_name}}', storageLocation: 'parentFolder' }).location).toBe(FolderNoteLocation.ParentFolder);
    });

    it('should read the plugin\'s hiding setting', () => {
      expect(autoConfigFor({ folderNoteName: 'index', hideFolderNote: true, storageLocation: 'insideFolder' }).isHidden).toBe(true);
      expect(autoConfigFor({ folderNoteName: 'index', hideFolderNote: 'yes', storageLocation: 'insideFolder' }).isHidden).toBe(false);
    });

    it('should try the plugin\'s primary type first and its other supported types after it', () => {
      expect(
        autoConfigFor({
          folderNoteName: 'index',
          folderNoteType: '.canvas',
          storageLocation: 'insideFolder',
          supportedFileTypes: ['md', 'canvas', 42]
        }).extensions
      ).toEqual(['canvas', 'md']);
    });

    it('should treat the plugin\'s Excalidraw type as Markdown, as the plugin itself does', () => {
      expect(
        autoConfigFor({
          folderNoteName: 'index',
          folderNoteType: '.excalidraw',
          storageLocation: 'insideFolder',
          supportedFileTypes: ['excalidraw']
        }).extensions
      ).toEqual(['md']);
    });

    it('should keep Markdown resolvable even when the plugin names no usable type at all', () => {
      expect(
        autoConfigFor({
          folderNoteName: 'index',
          folderNoteType: 42,
          storageLocation: 'insideFolder',
          supportedFileTypes: 'not an array'
        }).extensions
      ).toEqual(['md']);
    });

    /*
     * Every shape below is a folder-notes install too old, too new or too broken to read. Each has to read
     * as "not configured" and fall back, because the alternative is an exception raised inside a click
     * handler.
     */
    it.each([
      ['the plugin keeps its notes in one central folder', { folderNoteName: '{{folder_name}}', storageLocation: 'vaultFolder' }],
      ['the storage location is not one it documents', { folderNoteName: '{{folder_name}}', storageLocation: null }],
      ['the settings are not an object', 'not an object'],
      ['the settings carry neither key', {}],
      ['no folder note is named at all', { storageLocation: 'insideFolder' }],
      ['the folder-note name is not a usable string', { folderNoteName: '', storageLocation: 'insideFolder' }],
      ['the folder-note name is not a string', { folderNoteName: 42, storageLocation: 'insideFolder' }]
    ])('should fall back when %s', (_description: string, folderNotesSettings: unknown) => {
      const config = autoConfigFor(folderNotesSettings);
      expect(config.extensions).toEqual(['md']);
      expect(config.location).toBe(FolderNoteLocation.InsideFolder);
      expect(resolveNameOf(config)).toBe('charlie');
    });

    it('should fall back when the installed plugin exposes no settings at all', () => {
      initApp(DEFAULT_FILES);
      // Registered directly rather than through `initApp`, which would give it a `settings` key: the case
      // Under test is a plugin that exposes none at all.
      appMock.plugins.registerPlugin__(FOLDER_NOTES_PLUGIN_ID, castTo<PluginOriginal>({}));
      expect(resolveFolderNoteConfig({ app }).location).toBe(FolderNoteLocation.InsideFolder);
    });
  });
});

describe('resolveFolderNote', () => {
  function resolve(files: Record<string, string>, folderPath: string, config?: FolderNoteConfig): null | string {
    initApp(files);
    return resolveFolderNote({
      app,
      folder: getFolder(folderPath),
      ...config && { config }
    })?.path ?? null;
  }

  function configFor(location: FolderNoteLocation, extensions?: readonly string[], name?: string): FolderNoteConfig {
    return {
      extensions: extensions ?? ['md'],
      isHidden: false,
      location: location as FolderNoteConfig['location'],
      resolveName: name === undefined ? (folder: TFolder): string => folder.name : (): string => name
    };
  }

  it('should find a note named after its folder, inside it', () => {
    expect(resolve(DEFAULT_FILES, 'alpha/bravo/charlie')).toBe('alpha/bravo/charlie/charlie.md');
  });

  it('should find a fixed-name note inside the folder', () => {
    expect(resolve({ 'alpha/bravo/charlie/!.md': '' }, 'alpha/bravo/charlie', configFor(FolderNoteLocation.InsideFolder, undefined, '!')))
      .toBe('alpha/bravo/charlie/!.md');
  });

  it('should find a note sitting beside the folder', () => {
    expect(resolve(
      {
        'alpha/bravo/charlie.md': '',
        'alpha/bravo/charlie/note.md': ''
      },
      'alpha/bravo/charlie',
      configFor(FolderNoteLocation.ParentFolder)
    )).toBe('alpha/bravo/charlie.md');
  });

  it('should find a note beside a top-level folder, at the vault root', () => {
    expect(resolve(
      {
        'charlie.md': '',
        'charlie/note.md': ''
      },
      'charlie',
      configFor(FolderNoteLocation.ParentFolder)
    )).toBe('charlie.md');
  });

  it('should try the configured extensions in order', () => {
    expect(resolve({ 'alpha/bravo/charlie/charlie.canvas': '' }, 'alpha/bravo/charlie', configFor(FolderNoteLocation.InsideFolder, ['md', 'canvas'])))
      .toBe('alpha/bravo/charlie/charlie.canvas');
  });

  it('should find nothing when folder notes are turned off', () => {
    expect(resolve(DEFAULT_FILES, 'alpha/bravo/charlie', configFor(FolderNoteLocation.None))).toBeNull();
  });

  it('should find nothing when the folder simply has no folder note', () => {
    expect(resolve({ 'alpha/bravo/charlie/other.md': '' }, 'alpha/bravo/charlie')).toBeNull();
  });

  it('should find nothing when the name resolves to nothing', () => {
    expect(resolve(DEFAULT_FILES, 'alpha/bravo/charlie', configFor(FolderNoteLocation.InsideFolder, undefined, ' '.repeat(3)))).toBeNull();
  });

  it('should find nothing beside the vault root, which has no parent to hold a note', () => {
    initApp({ 'charlie/note.md': '' });
    expect(resolveFolderNote({
      app,
      config: configFor(FolderNoteLocation.ParentFolder),
      folder: app.vault.getRoot()
    })).toBeNull();
  });
});
