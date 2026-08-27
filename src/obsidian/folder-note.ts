/**
 * @file
 *
 * The folder-note concept: which note, if any, is the one whose properties describe a FOLDER itself.
 *
 * Obsidian has no such concept — it is a convention the community settled on, and the plugin that owns it
 * for most vaults is [`folder-notes`](https://community.obsidian.md/plugins/folder-notes). So the answer to
 * "which note belongs to this folder" is that plugin's to give whenever it is installed, and this module
 * asks it rather than inventing a second answer: {@link FolderNoteLocation.Auto} — the default — reads its
 * live configuration at every use.
 *
 * Reading it live rather than copying its values into a consumer's own settings is deliberate: a copy goes
 * stale the moment that plugin is reconfigured, and it would need a settings migration to seed. Everything
 * else is the caller's explicit choice, and then the other plugin is not consulted at all.
 *
 * Nothing here ever CREATES a note. A folder with no folder note answers `null`, which is what lets a
 * caller layer folder-note behavior onto a click without risking a file appearing on the user's disk.
 */

import type {
  App,
  TFile,
  TFolder
} from 'obsidian';

import { normalizePath } from 'obsidian';

import { join } from '../path.ts';
import { replaceAll } from '../string.ts';
import { MARKDOWN_FILE_EXTENSION } from './file-system.ts';

/**
 * Where a folder's folder note lives.
 *
 * The three concrete members are the shapes the folder-note ecosystem actually uses:
 * `charlie/charlie.md` and `charlie/index.md` are both {@link FolderNoteLocation.InsideFolder} (they
 * differ only in the NAME, which is why naming is a callback and not a fourth member), while
 * `charlie.md` beside the folder is {@link FolderNoteLocation.ParentFolder} — whose whole point is that
 * `[[alpha/bravo/charlie]]` links to a folder with no special syntax.
 */
export enum FolderNoteLocation {
  /**
   * Take the answer from the installed `folder-notes` plugin, falling back to a note named after its
   * folder, inside it. The default, and resolved LIVE rather than copied.
   */
  Auto = 'Auto',

  /**
   * `alpha/bravo/charlie/<name>.md`.
   */
  InsideFolder = 'InsideFolder',

  /**
   * The vault has no folder notes at all, so every folder answers `null`. This is also how a caller opts
   * out of folder-note behavior entirely.
   */
  None = 'None',

  /**
   * `alpha/bravo/<name>.md`, beside the folder.
   */
  ParentFolder = 'ParentFolder'
}

/**
 * A folder-note setup with {@link FolderNoteLocation.Auto} already resolved to a concrete answer.
 */
export interface FolderNoteConfig {
  /**
   * The extensions a folder note may carry, WITHOUT the leading dot, in resolution order — the first one
   * that names an existing file wins.
   */
  readonly extensions: readonly string[];

  /**
   * Whether the folder note is hidden in the file explorer.
   *
   * Read rather than acted upon here: it changes nothing about WHICH file is the folder note, but a caller
   * that reveals the note has to know there is nothing to reveal and fall back to revealing the folder.
   */
  readonly isHidden: boolean;

  /**
   * Where the note sits relative to its folder.
   */
  readonly location: FolderNoteLocation.InsideFolder | FolderNoteLocation.None | FolderNoteLocation.ParentFolder;

  /**
   * Names the folder note of a folder, WITHOUT its extension.
   *
   * @param folder - The folder whose note is being named.
   * @returns The note's name; an empty (or blank) name means the folder has no folder note.
   */
  // `this: void` because it is a standalone callback, never a method of the config — which is also what
  // Lets it be destructured and handed on without tripping `unbound-method`.
  resolveName(this: void, folder: TFolder): string;
}

/**
 * Parameters for {@link resolveFolderNoteConfig}.
 */
export interface ResolveFolderNoteConfigParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The extensions a folder note may carry, with or without the leading dot, in resolution order. Ignored
   * under {@link FolderNoteLocation.Auto}, which takes the installed plugin's answer whole.
   *
   * @default `['md']`
   */
  readonly extensions?: readonly string[];

  /**
   * Whether the folder note is hidden in the file explorer. Ignored under {@link FolderNoteLocation.Auto}.
   *
   * @default `false`
   */
  readonly isHidden?: boolean;

  /**
   * Where the note sits relative to its folder.
   *
   * @default {@link FolderNoteLocation.Auto}
   */
  readonly location?: FolderNoteLocation;

  /**
   * Names the folder note of a folder, WITHOUT its extension. Ignored under
   * {@link FolderNoteLocation.Auto}, which names the note the way the installed plugin does.
   *
   * A callback rather than a name template, because a template needs a token vocabulary and this library
   * has none to impose — a caller that has one (`{{folderName}}`, `{{folderPath}}`, …) renders it here.
   *
   * @param folder - The folder whose note is being named.
   * @returns The note's name.
   * @default `(folder) => folder.name`
   */
  // See {@link FolderNoteConfig.resolveName} for why `this: void`.
  resolveName?(this: void, folder: TFolder): string;
}

/**
 * Parameters for {@link resolveFolderNote}.
 */
export interface ResolveFolderNoteParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The already-resolved setup to use.
   *
   * Omitted means {@link FolderNoteLocation.Auto} — the setup is resolved on the spot, which is what makes
   * `resolveFolderNote({ app, folder })` the one-liner every caller wants. Pass one when the same setup is
   * used more than once, or when its {@link FolderNoteConfig.isHidden} is needed alongside the note.
   *
   * @default `resolveFolderNoteConfig({ app })`
   */
  readonly config?: FolderNoteConfig;

  /**
   * The folder whose folder note is wanted. Read AFTER any rename: the note is named from the folder's
   * CURRENT name, and a `folder-notes` install with `syncFolderName` on will have renamed it already.
   */
  readonly folder: TFolder;
}

/**
 * The `folder-notes` plugin's id, as its manifest declares it.
 */
export const FOLDER_NOTES_PLUGIN_ID = 'folder-notes';

/**
 * The one token `folder-notes`' own name template understands. Every other character in that template is
 * a literal, so translating this token is the whole of the translation.
 */
const FOLDER_NOTES_FOLDER_NAME_TOKEN_REG_EXP = /\{\{folder_name\}\}/gi;

/**
 * `folder-notes` offers Excalidraw folder notes, which are Markdown files with an Excalidraw payload — its
 * own resolver normalizes the type the same way before looking the file up.
 */
const EXCALIDRAW_FILE_EXTENSION = 'excalidraw';

/**
 * What {@link FolderNoteLocation.Auto} falls back to: the layout every folder-note plugin supports, and
 * the one `folder-notes` itself ships as its default. Nothing hides a note when no plugin is there to hide
 * it, so {@link FolderNoteConfig.isHidden} is `false`.
 */
const FALLBACK_FOLDER_NOTE_CONFIG: FolderNoteConfig = {
  extensions: [MARKDOWN_FILE_EXTENSION],
  isHidden: false,
  location: FolderNoteLocation.InsideFolder,
  resolveName: (folder: TFolder): string => folder.name
};

/**
 * Finds a folder's folder note — the one note whose properties describe the folder itself.
 *
 * **Never creates.** A folder that has no folder note answers `null`, and so does the vault root under
 * {@link FolderNoteLocation.ParentFolder} (nothing can sit beside it).
 *
 * @param params - The folder, and optionally the setup to resolve it with.
 * @returns The folder note, or `null` when there is none.
 */
export function resolveFolderNote(params: ResolveFolderNoteParams): null | TFile {
  const { app, folder } = params;
  const config = params.config ?? resolveFolderNoteConfig({ app });
  if (config.location === FolderNoteLocation.None) {
    return null;
  }

  const parentFolderPath = config.location === FolderNoteLocation.ParentFolder ? folder.parent?.path : folder.path;
  if (parentFolderPath === undefined) {
    return null;
  }

  const noteName = config.resolveName(folder).trim();
  if (!noteName) {
    return null;
  }

  for (const extension of config.extensions) {
    const file = app.vault.getFileByPath(normalizePath(join(parentFolderPath, `${noteName}.${extension}`)));
    if (file) {
      return file;
    }
  }

  return null;
}

/**
 * Resolves {@link FolderNoteLocation.Auto} into a concrete folder-note setup.
 *
 * `folder-notes`' `vaultFolder` storage (every folder note pooled in one central folder) has no
 * counterpart here and falls back rather than guessing: with the notes pooled, the note belonging to a
 * folder is no longer derivable from that folder's path alone.
 *
 * @param params - The setup, and the app to read the installed plugin from.
 * @returns The resolved setup.
 */
export function resolveFolderNoteConfig(params: ResolveFolderNoteConfigParams): FolderNoteConfig {
  const {
    app,
    extensions,
    isHidden,
    location,
    resolveName
  } = params;

  if (location !== undefined && location !== FolderNoteLocation.Auto) {
    return {
      extensions: normalizeExtensions(extensions ?? [MARKDOWN_FILE_EXTENSION]),
      isHidden: isHidden ?? false,
      location,
      resolveName: resolveName ?? FALLBACK_FOLDER_NOTE_CONFIG.resolveName
    };
  }

  return readFolderNotesPluginConfig(app) ?? FALLBACK_FOLDER_NOTE_CONFIG;
}

/**
 * Normalizes extensions the way `folder-notes` does before it looks a file up: no leading dot, lower-case,
 * Excalidraw treated as Markdown, blanks dropped, duplicates collapsed while keeping the first occurrence's
 * position.
 *
 * @param extensions - The extensions as configured.
 * @returns The normalized extensions, in resolution order.
 */
function normalizeExtensions(extensions: readonly string[]): readonly string[] {
  const normalizedExtensions = extensions
    .map((extension) => extension.trim().toLowerCase().replace(/^\./, ''))
    .map((extension) => extension === EXCALIDRAW_FILE_EXTENSION ? MARKDOWN_FILE_EXTENSION : extension)
    .filter(Boolean);
  return [...new Set(normalizedExtensions)];
}

/**
 * Reads the installed `folder-notes` plugin's own configuration, if it is installed and configured the way
 * it documents.
 *
 * Every value is read as `unknown` and checked, rather than asserted into a shape: this is another
 * plugin's private settings object, so a version that renames or drops a key must degrade to the fallback
 * instead of throwing inside a click handler.
 *
 * @param app - The Obsidian application instance.
 * @returns The configuration, or `null` when the plugin is absent, not configured, or set to a storage
 * location with no counterpart here.
 */
function readFolderNotesPluginConfig(app: App): FolderNoteConfig | null {
  const folderNotesPlugin = app.plugins.getPlugin(FOLDER_NOTES_PLUGIN_ID);
  // Narrowed with `in` rather than asserted into a shape: that keeps every value below typed `unknown`,
  // Which is exactly what a foreign plugin's private settings are.
  if (!folderNotesPlugin || !('settings' in folderNotesPlugin)) {
    return null;
  }

  const folderNotesSettings: unknown = folderNotesPlugin.settings;
  if (typeof folderNotesSettings !== 'object' || folderNotesSettings === null) {
    return null;
  }

  const location = toFolderNoteLocation('storageLocation' in folderNotesSettings ? folderNotesSettings.storageLocation : null);
  if (!location) {
    return null;
  }

  const folderNoteName = 'folderNoteName' in folderNotesSettings ? folderNotesSettings.folderNoteName : null;
  if (typeof folderNoteName !== 'string' || !folderNoteName) {
    return null;
  }

  const folderNoteType = 'folderNoteType' in folderNotesSettings ? folderNotesSettings.folderNoteType : null;
  const supportedFileTypes = 'supportedFileTypes' in folderNotesSettings ? folderNotesSettings.supportedFileTypes : null;
  const isHidden = 'hideFolderNote' in folderNotesSettings ? folderNotesSettings.hideFolderNote : null;

  return {
    // Its own resolver tries the primary type first and every other supported type after it, which is the
    // Order reproduced here. An unusable pair leaves Markdown, the extension it cannot be configured
    // Without.
    extensions: normalizeExtensions([
      typeof folderNoteType === 'string' ? folderNoteType : MARKDOWN_FILE_EXTENSION,
      ...(Array.isArray(supportedFileTypes) ? supportedFileTypes.filter((type: unknown) => typeof type === 'string') : []),
      MARKDOWN_FILE_EXTENSION
    ]),
    isHidden: isHidden === true,
    location,
    resolveName: (folder: TFolder): string =>
      replaceAll({
        $string: folderNoteName,
        // A function replacer, so a folder name containing `$&` is inserted literally.
        replacer: () => folder.name,
        searchValue: FOLDER_NOTES_FOLDER_NAME_TOKEN_REG_EXP
      })
  };
}

/**
 * Maps `folder-notes`' `storageLocation` onto this library's own location.
 *
 * @param storageLocation - The value read out of that plugin's settings.
 * @returns The location, or `null` for `vaultFolder` and for anything that is not one of its values.
 */
function toFolderNoteLocation(storageLocation: unknown): FolderNoteConfig['location'] | null {
  switch (storageLocation) {
    case 'insideFolder': {
      return FolderNoteLocation.InsideFolder;
    }
    case 'parentFolder': {
      return FolderNoteLocation.ParentFolder;
    }
    default: {
      return null;
    }
  }
}
