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
import { chain } from './ChainedPromise.ts';
import {
  getFile,
  getFileOrNull,
  getFolderOrNull,
  isCanvasFile,
  isFile,
  isMarkdownFile,
  isNote
} from './FileSystem.ts';
import {
  editLinks,
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
  deleteEmptyFolderHierarchy,
  deleteSafe,
  process,
  renameSafe
} from './Vault.ts';
import { noopAsync } from '../Function.ts';

const deletedMetadataCacheMap = new Map<string, CachedMetadata>();
const handledRenames = new Set<string>();

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
  logRegisteredHandlers(plugin.app);

  plugin.register(() => {
    renameDeleteHandlersMap.delete(pluginId);
    logRegisteredHandlers(plugin.app);
  });

  const app = plugin.app;
  plugin.registerEvent(
    app.vault.on('delete', (file) => {
      if (!shouldInvokeHandler(app, pluginId)) {
        return;
      }
      const path = file.path;
      chain(app, () => handleDelete(app, path));
    })
  );

  plugin.registerEvent(
    app.vault.on('rename', (file, oldPath) => {
      if (!shouldInvokeHandler(app, pluginId)) {
        return;
      }
      const newPath = file.path;
      chain(app, () => handleRename(app, oldPath, newPath));
    })
  );

  plugin.registerEvent(
    app.metadataCache.on('deleted', (file, prevCache) => {
      handleMetadataDeleted(file, prevCache);
    })
  );
}

function shouldInvokeHandler(app: App, pluginId: string): boolean {
  const renameDeleteHandlerPluginIds = getRenameDeleteHandlersMap(app);
  const mainPluginId = Array.from(renameDeleteHandlerPluginIds.keys())[0];
  if (mainPluginId !== pluginId) {
    return false;
  }
  return true;
}

function getRenameDeleteHandlersMap(app: App): Map<string, () => Partial<RenameDeleteHandlerSettings>> {
  return getObsidianDevUtilsState(app, 'renameDeleteHandlersMap', new Map<string, () => Partial<RenameDeleteHandlerSettings>>()).value;
}

function logRegisteredHandlers(app: App): void {
  const renameDeleteHandlersMap = getRenameDeleteHandlersMap(app);
  console.debug(`Plugins with registered rename/delete handlers: ${Array.from(renameDeleteHandlersMap.keys()).join(', ')}`);
}

async function handleRename(app: App, oldPath: string, newPath: string): Promise<void> {
  console.debug(`Handle Rename ${oldPath} -> ${newPath}`);

  const newFile = getFileOrNull(app, newPath);
  if (!newFile) {
    return;
  }

  const key = makeKey(oldPath, newPath);
  if (handledRenames.has(key)) {
    handledRenames.delete(key);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const updateAllLinks = app.fileManager.updateAllLinks;
  app.fileManager.updateAllLinks = noopAsync;
  try {
    await renameHandled(app, newPath, oldPath);
    await processAndRename(app, oldPath, newPath);
  } finally {
    app.fileManager.updateAllLinks = updateAllLinks;
    const orphanKeys = Array.from(handledRenames);
    chain(app, () => {
      for (const key of orphanKeys) {
        handledRenames.delete(key);
      }
    });
  }
}

async function processAndRename(app: App, oldPath: string, newPath: string): Promise<void> {
  if (app.vault.adapter.insensitive && newPath.toLowerCase() === oldPath.toLowerCase() && dirname(newPath) === dirname(oldPath)) {
    const tempPath = join(dirname(oldPath), '__temp__' + basename(newPath));
    await processAndRename(app, oldPath, tempPath);
    await processAndRename(app, tempPath, newPath);
    return;
  }

  const settings = getSettings(app);
  const renameMap = new Map<string, string>();
  await fillRenameMap(app, oldPath, newPath, renameMap);

  const backlinksMap = new Map<string, Map<string, string>>();

  for (const oldPath2 of renameMap.keys()) {
    const currentBacklinksMap = await getBacklinksMap(app, [oldPath2]);
    for (const [backlinkPath, links] of currentBacklinksMap.entries()) {
      const newBacklinkPath = renameMap.get(backlinkPath) ?? backlinkPath;
      const linkJsonToPathMap = backlinksMap.get(newBacklinkPath) ?? new Map<string, string>();
      backlinksMap.set(newBacklinkPath, linkJsonToPathMap);
      for (const link of links) {
        linkJsonToPathMap.set(toJson(link), oldPath2);
      }
    }
  }

  const parentFolders = new Set<string>();

  for (const entry of renameMap.entries()) {
    const oldRelatedPath = entry[0];
    let newRelatedPath = entry[1];
    newRelatedPath = await renameHandled(app, oldRelatedPath, newRelatedPath);
    renameMap.set(oldRelatedPath, newRelatedPath);
    parentFolders.add(dirname(oldRelatedPath));
  }

  if (settings.shouldDeleteEmptyFolders) {
    for (const parentFolder of parentFolders) {
      await deleteEmptyFolderHierarchy(app, parentFolder);
    }
  }

  for (const [newBacklinkPath, linkJsonToPathMap] of backlinksMap.entries()) {
    await editLinks(app, newBacklinkPath, (link) => {
      const oldRelatedPath = linkJsonToPathMap.get(toJson(link));
      if (!oldRelatedPath) {
        return;
      }

      const newRelatedPath = renameMap.get(oldRelatedPath);
      if (!newRelatedPath) {
        return;
      }

      return updateLink({
        app: app,
        link,
        pathOrFile: newRelatedPath,
        oldPathOrFile: oldRelatedPath,
        sourcePathOrFile: newBacklinkPath,
        renameMap,
        shouldUpdateFilenameAlias: settings.shouldUpdateFilenameAliases
      });
    });
  }

  if (isCanvasFile(newPath)) {
    await process(app, newPath, (content) => {
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
  } else if (isMarkdownFile(newPath)) {
    await updateLinksInFile({
      app: app,
      pathOrFile: newPath,
      oldPathOrFile: oldPath,
      renameMap,
      shouldUpdateFilenameAlias: settings.shouldUpdateFilenameAliases
    });
  }
}

async function handleDelete(app: App, path: string): Promise<void> {
  console.debug(`Handle Delete ${path}`);
  if (!isNote(path)) {
    return;
  }

  const settings = getSettings(app);
  if (!settings.shouldDeleteOrphanAttachments) {
    return;
  }

  const cache = deletedMetadataCacheMap.get(path);
  deletedMetadataCacheMap.delete(path);
  if (cache) {
    const links = getAllLinks(cache);

    for (const link of links) {
      const attachmentFile = extractLinkFile(app, link, path);
      if (!attachmentFile) {
        continue;
      }

      if (isNote(attachmentFile)) {
        continue;
      }

      await deleteSafe(app, attachmentFile, path, settings.shouldDeleteEmptyFolders);
    }
  }

  const attachmentFolderPath = await getAttachmentFolderPath(app, path);
  const attachmentFolder = getFolderOrNull(app, attachmentFolderPath);

  if (!attachmentFolder) {
    return;
  }

  await deleteSafe(app, attachmentFolder, path, false, settings.shouldDeleteEmptyFolders);
}

async function fillRenameMap(app: App, oldPath: string, newPath: string, renameMap: Map<string, string>): Promise<void> {
  renameMap.set(oldPath, newPath);

  if (!isNote(oldPath)) {
    return;
  }

  const settings = getSettings(app);

  const oldAttachmentFolderPath = await getAttachmentFolderPath(app, oldPath);
  const newAttachmentFolderPath = settings.shouldRenameAttachmentFolder
    ? await getAttachmentFolderPath(app, newPath)
    : oldAttachmentFolderPath;
  const dummyOldAttachmentFolderPath = await getAttachmentFolderPath(app, join(dirname(oldPath), 'DUMMY_FILE.md'));

  const oldAttachmentFolder = getFolderOrNull(app, oldAttachmentFolderPath);

  if (!oldAttachmentFolder) {
    return;
  }

  if (oldAttachmentFolderPath === newAttachmentFolderPath && !settings.shouldRenameAttachmentFiles) {
    return;
  }

  const oldAttachmentFiles: TFile[] = [];

  if (oldAttachmentFolderPath === dummyOldAttachmentFolderPath) {
    const oldCache = await getCacheSafe(app, oldPath);
    if (!oldCache) {
      return;
    }
    for (const oldLink of getAllLinks(oldCache)) {
      const oldAttachmentFile = extractLinkFile(app, oldLink, oldPath);
      if (!oldAttachmentFile) {
        continue;
      }

      if (oldAttachmentFile.path.startsWith(oldAttachmentFolderPath)) {
        const oldAttachmentBacklinks = await getBacklinksForFileSafe(app, oldAttachmentFile);
        if (oldAttachmentBacklinks.keys().length === 1) {
          oldAttachmentFiles.push(oldAttachmentFile);
        }
      }
    }
  } else {
    Vault.recurseChildren(oldAttachmentFolder, (oldAttachmentFile) => {
      if (isFile(oldAttachmentFile)) {
        oldAttachmentFiles.push(oldAttachmentFile);
      }
    });
  }

  const oldBasename = basename(oldPath, extname(oldPath));
  const newBasename = basename(newPath, extname(newPath));

  for (const oldAttachmentFile of oldAttachmentFiles) {
    if (isNote(oldAttachmentFile)) {
      continue;
    }
    const relativePath = relative(oldAttachmentFolderPath, oldAttachmentFile.path);
    const newDir = join(newAttachmentFolderPath, dirname(relativePath));
    const newChildBasename = settings.shouldRenameAttachmentFiles
      ? oldAttachmentFile.basename.replaceAll(oldBasename, newBasename)
      : oldAttachmentFile.basename;
    let newChildPath = join(newDir, makeFileName(newChildBasename, oldAttachmentFile.extension));

    if (oldAttachmentFile.path === newChildPath) {
      continue;
    }

    if (settings.shouldDeleteConflictingAttachments) {
      const newChildFile = getFileOrNull(app, newChildPath);
      if (newChildFile) {
        await app.fileManager.trashFile(newChildFile);
      }
    } else {
      newChildPath = app.vault.getAvailablePath(join(newDir, newChildBasename), oldAttachmentFile.extension);
    }
    renameMap.set(oldAttachmentFile.path, newChildPath);
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

function makeKey(oldPath: string, newPath: string): string {
  return `${oldPath} -> ${newPath}`;
}

async function renameHandled(app: App, oldPath: string, newPath: string): Promise<string> {
  newPath = await renameSafe(app, getFile(app, oldPath), newPath);
  const key = makeKey(oldPath, newPath);
  handledRenames.add(key);
  return newPath;
}
