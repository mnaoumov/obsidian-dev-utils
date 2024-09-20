import type {
  CachedMetadata,
  Plugin,
  TAbstractFile
} from 'obsidian';
import {
  App,
  TFile,
  Vault
} from 'obsidian';
import type { CanvasData } from 'obsidian/canvas.js';

import { toJson } from '../Object.ts';
import {
  basename,
  dirname,
  extname,
  join,
  makeFileName,
  relative
} from '../Path.ts';
import { getObsidianDevUtilsState } from './App.ts';
import { getAttachmentFolderPath } from './AttachmentPath.ts';
import { chainAsyncFn } from './ChainedPromise.ts';
import {
  getFile,
  getFileOrNull,
  getFolderOrNull,
  isCanvasFile,
  isMarkdownFile,
  isNote
} from './FileSystem.ts';
import {
  extractLinkFile,
  updateLink,
  updateLinksInFile
} from './Link.ts';
import {
  getAllLinks,
  getBacklinksForFileSafe,
  getBacklinksMap,
  getCacheSafe
} from './MetadataCache.ts';
import {
  applyFileChanges,
  deleteEmptyFolderHierarchy,
  deleteSafe,
  processWithRetry,
  renameSafe
} from './Vault.ts';

const specialRenames: SpecialRename[] = [];
const deletedMetadataCacheMap = new Map<string, CachedMetadata>();

interface SpecialRename {
  oldPath: string;
  newPath: string;
  tempPath: string;
}

/**
 * Settings for the rename/delete handler.
 */
export interface RenameDeleteHandlerSettings {
  /**
   * Whether to delete conflicting attachments.
   */
  shouldDeleteConflictingAttachments: boolean;

  /**
   * Whether to delete empty folders.
   */
  shouldDeleteEmptyFolders: boolean;

  /**
   * Whether to delete orphan attachments after a delete.
   */
  shouldDeleteOrphanAttachments: boolean;

  /**
   * Whether to rename attachment files when a note is renamed.
   */
  shouldRenameAttachmentFiles: boolean;

  /**
    * Whether to rename attachment folder when a note is renamed.
    */
  shouldRenameAttachmentFolder: boolean;

  /**
   * Whether to update filename aliases when a note is renamed.
   */
  shouldUpdateFilenameAliases: boolean;

  /**
   * Whether to update links when a note or attachment is renamed.
   */
  shouldUpdateLinks: boolean;
}

/**
 * Registers the rename/delete handlers.
 * @param plugin - The plugin instance.
 * @param settingsBuilder - A function that returns the settings for the rename delete handler.
 * @returns void
 */
export function registerRenameDeleteHandlers(plugin: Plugin, settingsBuilder: () => Partial<RenameDeleteHandlerSettings>): void {
  const renameDeleteHandlersMap = getRenameDeleteHandlersMap(plugin.app);
  const pluginId = plugin.manifest.id;

  renameDeleteHandlersMap.set(pluginId, settingsBuilder);
  logPluginSettingsOrder(plugin.app);

  plugin.register(() => {
    renameDeleteHandlersMap.delete(pluginId);
    logPluginSettingsOrder(plugin.app);
  });

  const app = plugin.app;
  plugin.registerEvent(
    app.vault.on('delete', (file) => {
      if (!shouldInvokeHandler(app, pluginId, 'Delete')) {
        return;
      }
      chainAsyncFn(app, () => handleDelete(app, file));
    })
  );

  plugin.registerEvent(
    app.vault.on('rename', (file, oldPath) => {
      if (!shouldInvokeHandler(app, pluginId, 'Rename')) {
        return;
      }
      chainAsyncFn(app, () => handleRename(app, file, oldPath));
    })
  );

  plugin.registerEvent(
    app.metadataCache.on('deleted', (file, prevCache) => {
      handleMetadataDeleted(file, prevCache);
    })
  );
}

function shouldInvokeHandler(app: App, pluginId: string, handlerType: string): boolean {
  const renameDeleteHandlerPluginIds = getRenameDeleteHandlersMap(app);
  const mainPluginId = Array.from(renameDeleteHandlerPluginIds.keys())[0];
  if (mainPluginId !== pluginId) {
    console.debug(`${handlerType} handler for plugin ${pluginId} is skipped, because it is handled by plugin ${mainPluginId ?? '(none)'}`);
    return false;
  }
  return true;
}

function getRenameDeleteHandlersMap(app: App): Map<string, () => Partial<RenameDeleteHandlerSettings>> {
  return getObsidianDevUtilsState(app, 'renameDeleteHandlersMap', new Map<string, () => Partial<RenameDeleteHandlerSettings>>()).value;
}

function logPluginSettingsOrder(app: App): void {
  const renameDeleteHandlersMap = getRenameDeleteHandlersMap(app);
  console.debug(`Rename/delete handlers will use plugin settings in the following order: ${Array.from(renameDeleteHandlersMap.keys()).join(', ')}`);
}

async function handleRename(app: App, file: TAbstractFile, oldPath: string): Promise<void> {
  console.debug(`Handle Rename ${oldPath} -> ${file.path}`);

  if (!(file instanceof TFile)) {
    return;
  }

  const specialRename = specialRenames.find((x) => x.oldPath === file.path);
  if (specialRename) {
    const newTempPath = await renameSafe(app, file, specialRename.tempPath);
    specialRename.tempPath = newTempPath;
    return;
  }

  if (app.vault.adapter.insensitive && oldPath.toLowerCase() === file.path.toLowerCase() && dirname(oldPath) === dirname(file.path)) {
    specialRenames.push({
      oldPath,
      newPath: file.path,
      tempPath: join(file.parent?.path ?? '', '__temp__' + file.name)
    });

    await renameSafe(app, file, oldPath);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const updateAllLinks = app.fileManager.updateAllLinks;
  try {
    app.fileManager.updateAllLinks = async (): Promise<void> => {
      // do nothing
    };

    const renameMap = new Map<string, string>();
    await fillRenameMap(app, file, oldPath, renameMap);
    renameMap.set(oldPath, file.path);

    for (const [oldPath2, newPath2] of renameMap.entries()) {
      await processRename(app, oldPath2, newPath2, renameMap);
    }
  } finally {
    app.fileManager.updateAllLinks = updateAllLinks;

    const specialRename = specialRenames.find((x) => x.tempPath === file.path);
    if (specialRename) {
      await renameSafe(app, file, specialRename.newPath);
      specialRenames.remove(specialRename);
    }
  }
}

async function handleDelete(app: App, file: TAbstractFile): Promise<void> {
  console.debug(`Handle Delete ${file.path}`);
  if (!isNote(file)) {
    return;
  }

  const settings = getSettings(app);
  if (!settings.shouldDeleteOrphanAttachments) {
    return;
  }

  const cache = deletedMetadataCacheMap.get(file.path);
  deletedMetadataCacheMap.delete(file.path);
  if (cache) {
    const links = getAllLinks(cache);

    for (const link of links) {
      const attachmentFile = extractLinkFile(app, link, file.path);
      if (!attachmentFile) {
        continue;
      }

      if (isNote(attachmentFile)) {
        continue;
      }

      await deleteSafe(app, attachmentFile, file.path, settings.shouldDeleteEmptyFolders);
    }
  }

  const attachmentFolderPath = await getAttachmentFolderPath(app, file.path);
  const attachmentFolder = getFolderOrNull(app, attachmentFolderPath);

  if (!attachmentFolder) {
    return;
  }

  await deleteSafe(app, attachmentFolder, file.path, false, settings.shouldDeleteEmptyFolders);
}

async function fillRenameMap(app: App, file: TFile, oldPath: string, renameMap: Map<string, string>): Promise<void> {
  if (!isNote(file)) {
    return;
  }

  const settings = getSettings(app);

  const oldAttachmentFolderPath = await getAttachmentFolderPath(app, oldPath);
  const newAttachmentFolderPath = settings.shouldRenameAttachmentFolder
    ? await getAttachmentFolderPath(app, file.path)
    : oldAttachmentFolderPath;
  const dummyOldAttachmentFolderPath = await getAttachmentFolderPath(app, join(dirname(oldPath), 'DUMMY_FILE.md'));

  const oldAttachmentFolder = getFolderOrNull(app, oldAttachmentFolderPath);

  if (!oldAttachmentFolder) {
    return;
  }

  if (oldAttachmentFolderPath === newAttachmentFolderPath && !settings.shouldRenameAttachmentFiles) {
    return;
  }

  const children: TFile[] = [];

  if (oldAttachmentFolderPath === dummyOldAttachmentFolderPath) {
    const cache = await getCacheSafe(app, file);
    if (!cache) {
      return;
    }
    for (const link of getAllLinks(cache)) {
      const attachmentFile = extractLinkFile(app, link, oldPath);
      if (!attachmentFile) {
        continue;
      }

      if (attachmentFile.path.startsWith(oldAttachmentFolderPath)) {
        const backlinks = await getBacklinksForFileSafe(app, attachmentFile);
        if (backlinks.keys().length === 1) {
          children.push(attachmentFile);
        }
      }
    }
  } else {
    Vault.recurseChildren(oldAttachmentFolder, (child) => {
      if (child instanceof TFile) {
        children.push(child);
      }
    });
  }

  const oldNoteBaseName = basename(oldPath, extname(oldPath));

  for (const child of children) {
    if (isNote(child)) {
      continue;
    }
    const relativePath = relative(oldAttachmentFolderPath, child.path);
    const newDir = join(newAttachmentFolderPath, dirname(relativePath));
    const newChildBasename = settings.shouldRenameAttachmentFiles
      ? child.basename.replaceAll(oldNoteBaseName, file.basename)
      : child.basename;
    let newChildPath = join(newDir, makeFileName(newChildBasename, child.extension));
    if (child.path !== newChildPath) {
      if (settings.shouldDeleteConflictingAttachments) {
        const newChildFile = getFileOrNull(app, newChildPath);
        if (newChildFile) {
          await app.fileManager.trashFile(newChildFile);
        }
      } else {
        newChildPath = app.vault.getAvailablePath(join(newDir, newChildBasename), child.extension);
      }
      renameMap.set(child.path, newChildPath);
    }
  }
}

async function processRename(app: App, oldPath: string, newPath: string, renameMap: Map<string, string>): Promise<void> {
  const settings = getSettings(app);
  let oldFile = getFileOrNull(app, oldPath);

  if (oldFile) {
    const oldFolder = oldFile.parent;
    newPath = await renameSafe(app, oldFile, newPath);
    renameMap.set(oldPath, newPath);

    if (settings.shouldDeleteEmptyFolders) {
      await deleteEmptyFolderHierarchy(app, oldFolder);
    }
  }

  oldFile = getFile(app, oldPath, true);
  const newFile = getFileOrNull(app, newPath);

  if (!oldFile.deleted || !newFile) {
    throw new Error(`Could not rename ${oldPath} to ${newPath}`);
  }

  if (!settings.shouldUpdateLinks) {
    return;
  }

  const backlinks = await getBacklinksMap(app, [oldFile, newFile]);

  for (const parentNotePath of backlinks.keys()) {
    let parentNote = getFileOrNull(app, parentNotePath);
    if (!parentNote) {
      const newParentNotePath = renameMap.get(parentNotePath);
      if (newParentNotePath) {
        parentNote = getFileOrNull(app, newParentNotePath);
      }
    }

    if (!parentNote) {
      console.warn(`Parent note not found: ${parentNotePath}`);
      continue;
    }

    await applyFileChanges(app, parentNote, async () => {
      const backlinks = await getBacklinksMap(app, [oldFile, newFile]);
      const links = backlinks.get(parentNotePath) ?? [];
      const changes = [];

      for (const link of links) {
        changes.push({
          startIndex: link.position.start.offset,
          endIndex: link.position.end.offset,
          oldContent: link.original,
          newContent: updateLink({
            app: app,
            link,
            pathOrFile: newFile,
            oldPathOrFile: oldPath,
            sourcePathOrFile: parentNote,
            renameMap,
            shouldUpdateFilenameAlias: settings.shouldUpdateFilenameAliases
          })
        });
      }

      return changes;
    });
  }

  if (isCanvasFile(newFile)) {
    await processWithRetry(app, newFile, (content) => {
      const canvasData = JSON.parse(content) as CanvasData;
      for (const node of canvasData.nodes) {
        if (node.type !== 'file') {
          continue;
        }
        const newPath = renameMap.get(node.file);
        if (!newPath) {
          continue;
        }
        node.file = newPath;
      }
      return toJson(canvasData);
    });
  } else if (isMarkdownFile(newFile)) {
    await updateLinksInFile({
      app: app,
      pathOrFile: newFile,
      oldPathOrFile: oldPath,
      renameMap,
      shouldUpdateFilenameAlias: settings.shouldUpdateFilenameAliases
    });
  }
}

function getSettings(app: App): Partial<RenameDeleteHandlerSettings> {
  const renameDeleteHandlersMap = getRenameDeleteHandlersMap(app);
  const settingsBuilders = Array.from(renameDeleteHandlersMap.values()).reverse();

  const settings: Partial<RenameDeleteHandlerSettings> = {};
  for (const settingsBuilder of settingsBuilders) {
    const newSettings = settingsBuilder();
    for (const [key, value] of Object.entries(newSettings) as [keyof RenameDeleteHandlerSettings, boolean][]) {
      settings[key] ||= value;
    }
  }

  return settings;
}

function handleMetadataDeleted(file: TAbstractFile, prevCache: CachedMetadata | null): void {
  if (isMarkdownFile(file) && prevCache) {
    deletedMetadataCacheMap.set(file.path, prevCache);
  }
}
