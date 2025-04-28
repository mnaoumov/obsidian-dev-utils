/**
 * @packageDocumentation
 *
 * Contains utility functions for handling rename and delete events in Obsidian.
 */

import type {
  App,
  CachedMetadata,
  FileManager,
  Plugin,
  Reference,
  TAbstractFile,
  TFile
} from 'obsidian';
import type {
  LinkUpdate,
  LinkUpdatesHandler
} from 'obsidian-typings';

import { Vault } from 'obsidian';

import type {
  UpdateLinkOptions,
  UpdateLinksInFileOptions
} from './Link.ts';

import { getLibDebugger } from '../Debug.ts';
import {
  normalizeOptionalProperties,
  toJson
} from '../Object.ts';
import {
  basename,
  dirname,
  extname,
  join,
  makeFileName,
  relative
} from '../Path.ts';
import { replaceAll } from '../String.ts';
import { getObsidianDevUtilsState } from './App.ts';
import {
  getAttachmentFolderPath,
  hasOwnAttachmentFolder
} from './AttachmentPath.ts';
import {
  getFile,
  getFileOrNull,
  getFolderOrNull,
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
  getBacklinksForFileOrPath,
  getBacklinksForFileSafe,
  tempRegisterFileAndRun
} from './MetadataCache.ts';
import { registerPatch } from './MonkeyAround.ts';
import { addToQueue } from './Queue.ts';
import {
  getSafeRenamePath,
  renameSafe
} from './Vault.ts';
import {
  deleteEmptyFolderHierarchy,
  deleteSafe
} from './VaultEx.ts';

const deletedMetadataCacheMap = new Map<string, CachedMetadata>();
const handledRenames = new Set<string>();
const interruptedRenamesMap = new Map<string, InterruptedRename[]>();

/**
 * The behavior of the rename/delete handler when deleting empty attachment folders.
 */
export enum EmptyAttachmentFolderBehavior {
  /**
   * Delete the empty attachment folder.
   */
  Delete = 'Delete',

  /**
   * Delete the empty attachment folder and all its empty parents.
   */
  DeleteWithEmptyParents = 'DeleteWithEmptyParents',

  /**
   * Keep the empty attachment folder.
   */
  Keep = 'Keep'
}

/**
 * Settings for the rename/delete handler.
 */
export interface RenameDeleteHandlerSettings {
  /**
   * The behavior of the rename/delete handler when deleting empty attachment folders.
   */
  emptyAttachmentFolderBehavior: EmptyAttachmentFolderBehavior;

  /**
   * Whether the path is a note.
   */
  isNote(path: string): boolean;

  /**
   * Whether to ignore the path.
   */
  isPathIgnored(path: string): boolean;

  /**
   * Whether to delete conflicting attachments.
   */
  shouldDeleteConflictingAttachments: boolean;

  /**
   * Whether to handle deletions.
   */
  shouldHandleDeletions: boolean;

  /**
   * Whether to handle renames.
   */
  shouldHandleRenames: boolean;

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
}

interface InterruptedRename {
  combinedBacklinksMap: Map<string, Map<string, string>>;
  oldPath: string;
}

type RunAsyncLinkUpdateFn = FileManager['runAsyncLinkUpdate'];

/**
 * Registers the rename/delete handlers.
 *
 * @param plugin - The plugin instance.
 * @param settingsBuilder - A function that returns the settings for the rename delete handler.
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
      handleDeleteIfEnabled(plugin, file);
    })
  );

  plugin.registerEvent(
    app.vault.on('rename', (file, oldPath) => {
      handleRenameIfEnabled(plugin, file, oldPath);
    })
  );

  plugin.registerEvent(
    app.metadataCache.on('deleted', (file, prevCache) => {
      handleMetadataDeletedIfEnabled(plugin, file, prevCache);
    })
  );

  registerPatch(plugin, app.fileManager, {
    runAsyncLinkUpdate: (next: RunAsyncLinkUpdateFn): RunAsyncLinkUpdateFn => {
      return (linkUpdatesHandler) => runAsyncLinkUpdate(app, next, linkUpdatesHandler);
    }
  });
}

async function continueInterruptedRenames(
  app: App,
  oldPath: string,
  newPath: string,
  oldPathBacklinksMap: Map<string, Reference[]>,
  oldPathLinks: Reference[]
): Promise<void> {
  const interruptedRenames = interruptedRenamesMap.get(oldPath);
  if (interruptedRenames) {
    interruptedRenamesMap.delete(oldPath);
    for (const interruptedRename of interruptedRenames) {
      await handleRenameAsync(app, interruptedRename.oldPath, newPath, oldPathBacklinksMap, oldPathLinks, interruptedRename.combinedBacklinksMap);
    }
  }
}

async function fillRenameMap(app: App, oldPath: string, newPath: string, renameMap: Map<string, string>, oldPathLinks: Reference[]): Promise<void> {
  renameMap.set(oldPath, newPath);

  if (!isNoteEx(app, oldPath)) {
    return;
  }

  const settings = getSettings(app);

  const oldAttachmentFolderPath = await getAttachmentFolderPath(app, oldPath);
  const newAttachmentFolderPath = settings.shouldRenameAttachmentFolder
    ? await getAttachmentFolderPath(app, newPath)
    : oldAttachmentFolderPath;

  const isOldAttachmentFolderAtRoot = oldAttachmentFolderPath === '/';

  const oldAttachmentFolder = getFolderOrNull(app, oldAttachmentFolderPath);

  if (!oldAttachmentFolder) {
    return;
  }

  if (oldAttachmentFolderPath === newAttachmentFolderPath && !settings.shouldRenameAttachmentFiles) {
    return;
  }

  const oldAttachmentFiles: TFile[] = [];

  if (await hasOwnAttachmentFolder(app, oldPath)) {
    Vault.recurseChildren(oldAttachmentFolder, (oldAttachmentFile) => {
      if (isFile(oldAttachmentFile)) {
        oldAttachmentFiles.push(oldAttachmentFile);
      }
    });
  } else {
    for (const oldPathLink of oldPathLinks) {
      const oldAttachmentFile = extractLinkFile(app, oldPathLink, oldPath);
      if (!oldAttachmentFile) {
        continue;
      }

      if (isOldAttachmentFolderAtRoot || oldAttachmentFile.path.startsWith(oldAttachmentFolderPath)) {
        const oldAttachmentBacklinks = await getBacklinksForFileSafe(app, oldAttachmentFile);
        if (oldAttachmentBacklinks.keys().length === 1) {
          oldAttachmentFiles.push(oldAttachmentFile);
        }
      }
    }
  }

  const oldBasename = basename(oldPath, extname(oldPath));
  const newBasename = basename(newPath, extname(newPath));

  for (const oldAttachmentFile of oldAttachmentFiles) {
    if (isNoteEx(app, oldAttachmentFile.path)) {
      continue;
    }
    const relativePath = isOldAttachmentFolderAtRoot ? oldAttachmentFile.path : relative(oldAttachmentFolderPath, oldAttachmentFile.path);
    const newFolder = join(newAttachmentFolderPath, dirname(relativePath));
    const newChildBasename = settings.shouldRenameAttachmentFiles
      ? replaceAll(oldAttachmentFile.basename, oldBasename, newBasename)
      : oldAttachmentFile.basename;
    let newChildPath = join(newFolder, makeFileName(newChildBasename, oldAttachmentFile.extension));

    if (oldAttachmentFile.path === newChildPath) {
      continue;
    }

    if (settings.shouldDeleteConflictingAttachments) {
      const newChildFile = getFileOrNull(app, newChildPath);
      if (newChildFile) {
        await app.fileManager.trashFile(newChildFile);
      }
    } else {
      newChildPath = app.vault.getAvailablePath(join(newFolder, newChildBasename), oldAttachmentFile.extension);
    }
    renameMap.set(oldAttachmentFile.path, newChildPath);
  }
}

function getRenameDeleteHandlersMap(app: App): Map<string, () => Partial<RenameDeleteHandlerSettings>> {
  return getObsidianDevUtilsState(app, 'renameDeleteHandlersMap', new Map<string, () => Partial<RenameDeleteHandlerSettings>>()).value;
}

function getSettings(app: App): Partial<RenameDeleteHandlerSettings> {
  const renameDeleteHandlersMap = getRenameDeleteHandlersMap(app);
  const settingsBuilders = Array.from(renameDeleteHandlersMap.values()).reverse();

  const settings: Partial<RenameDeleteHandlerSettings> = {};
  settings.isNote = (path: string): boolean => isNote(app, path);
  settings.isPathIgnored = (): boolean => false;

  for (const settingsBuilder of settingsBuilders) {
    const newSettings = settingsBuilder();
    settings.shouldDeleteConflictingAttachments ||= newSettings.shouldDeleteConflictingAttachments ?? false;
    if (newSettings.emptyAttachmentFolderBehavior) {
      settings.emptyAttachmentFolderBehavior ??= newSettings.emptyAttachmentFolderBehavior;
    }
    settings.shouldHandleDeletions ||= newSettings.shouldHandleDeletions ?? false;
    settings.shouldHandleRenames ||= newSettings.shouldHandleRenames ?? false;
    settings.shouldRenameAttachmentFiles ||= newSettings.shouldRenameAttachmentFiles ?? false;
    settings.shouldRenameAttachmentFolder ||= newSettings.shouldRenameAttachmentFolder ?? false;
    settings.shouldUpdateFilenameAliases ||= newSettings.shouldUpdateFilenameAliases ?? false;
    const isPathIgnored = settings.isPathIgnored;
    settings.isPathIgnored = (path: string): boolean => isPathIgnored(path) || (newSettings.isPathIgnored?.(path) ?? false);
    const currentIsNote = settings.isNote;
    settings.isNote = (path: string): boolean => currentIsNote(path) && (newSettings.isNote?.(path) ?? true);
  }

  settings.emptyAttachmentFolderBehavior ??= EmptyAttachmentFolderBehavior.Keep;
  return settings;
}

async function handleCaseCollision(
  app: App,
  oldPath: string,
  newPath: string,
  oldPathBacklinksMap: Map<string, Reference[]>,
  oldPathLinks: Reference[]
): Promise<boolean> {
  if (!app.vault.adapter.insensitive || oldPath.toLowerCase() !== newPath.toLowerCase()) {
    return false;
  }

  const tempPath = join(dirname(newPath), `__temp__${basename(newPath)}`);
  await renameHandled(app, newPath, tempPath);
  await handleRenameAsync(app, oldPath, tempPath, oldPathBacklinksMap, oldPathLinks);
  await app.vault.rename(getFile(app, tempPath), newPath);
  return true;
}

async function handleDelete(app: App, path: string): Promise<void> {
  getLibDebugger('RenameDeleteHandler:handleDelete')(`Handle Delete ${path}`);
  if (!isNoteEx(app, path)) {
    return;
  }

  const settings = getSettings(app);
  if (!settings.shouldHandleDeletions) {
    return;
  }

  if (settings.isPathIgnored?.(path)) {
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

      if (isNoteEx(app, attachmentFile.path)) {
        continue;
      }

      await deleteSafe(app, attachmentFile, path, settings.emptyAttachmentFolderBehavior !== EmptyAttachmentFolderBehavior.Keep);
    }
  }

  const attachmentFolderPath = await getAttachmentFolderPath(app, path);
  const attachmentFolder = getFolderOrNull(app, attachmentFolderPath);

  if (!attachmentFolder) {
    return;
  }

  if (!(await hasOwnAttachmentFolder(app, path))) {
    return;
  }

  await deleteSafe(app, attachmentFolder, path, false, settings.emptyAttachmentFolderBehavior !== EmptyAttachmentFolderBehavior.Keep);
}

function handleDeleteIfEnabled(plugin: Plugin, file: TAbstractFile): void {
  const app = plugin.app;
  if (!shouldInvokeHandler(plugin)) {
    return;
  }
  const path = file.path;
  addToQueue(app, () => handleDelete(app, path));
}

function handleMetadataDeleted(app: App, file: TAbstractFile, prevCache: CachedMetadata | null): void {
  const settings = getSettings(app);
  if (settings.isPathIgnored?.(file.path)) {
    return;
  }

  if (!settings.shouldHandleDeletions) {
    return;
  }
  if (isMarkdownFile(app, file) && prevCache) {
    deletedMetadataCacheMap.set(file.path, prevCache);
  }
}

function handleMetadataDeletedIfEnabled(plugin: Plugin, file: TAbstractFile, prevCache: CachedMetadata | null): void {
  if (!shouldInvokeHandler(plugin)) {
    return;
  }
  handleMetadataDeleted(plugin.app, file, prevCache);
}

function handleRename(app: App, oldPath: string, newPath: string): void {
  const key = makeKey(oldPath, newPath);
  getLibDebugger('RenameDeleteHandler:handleRename')(`Handle Rename ${key}`);
  if (handledRenames.has(key)) {
    handledRenames.delete(key);
    return;
  }

  const settings = getSettings(app);
  if (!settings.shouldHandleRenames || settings.isPathIgnored?.(oldPath) || settings.isPathIgnored?.(newPath)) {
    return;
  }

  const cache = app.metadataCache.getCache(oldPath) ?? app.metadataCache.getCache(newPath);
  const oldPathLinks = cache ? getAllLinks(cache) : [];
  const oldPathBacklinksMap = getBacklinksForFileOrPath(app, oldPath).data;
  addToQueue(app, () => handleRenameAsync(app, oldPath, newPath, oldPathBacklinksMap, oldPathLinks));
}

async function handleRenameAsync(
  app: App,
  oldPath: string,
  newPath: string,
  oldPathBacklinksMap: Map<string, Reference[]>,
  oldPathLinks: Reference[],
  interruptedCombinedBacklinksMap?: Map<string, Map<string, string>>
): Promise<void> {
  await continueInterruptedRenames(app, oldPath, newPath, oldPathBacklinksMap, oldPathLinks);
  await refreshLinks(app, oldPath, newPath, oldPathBacklinksMap, oldPathLinks);
  if (await handleCaseCollision(app, oldPath, newPath, oldPathBacklinksMap, oldPathLinks)) {
    return;
  }

  try {
    const renameMap = new Map<string, string>();
    await fillRenameMap(app, oldPath, newPath, renameMap, oldPathLinks);

    const combinedBacklinksMap = new Map<string, Map<string, string>>();
    initBacklinksMap(oldPathBacklinksMap, renameMap, combinedBacklinksMap, oldPath);

    for (const attachmentOldPath of renameMap.keys()) {
      if (attachmentOldPath === oldPath) {
        continue;
      }
      const attachmentOldPathBacklinksMap = (await getBacklinksForFileSafe(app, attachmentOldPath)).data;
      initBacklinksMap(attachmentOldPathBacklinksMap, renameMap, combinedBacklinksMap, attachmentOldPath);
    }

    const parentFolders = new Set<string>();

    for (const [oldAttachmentPath, newAttachmentPath] of renameMap.entries()) {
      if (oldAttachmentPath === oldPath) {
        continue;
      }
      const fixedNewAttachmentPath = await renameHandled(app, oldAttachmentPath, newAttachmentPath);
      renameMap.set(oldAttachmentPath, fixedNewAttachmentPath);
      parentFolders.add(dirname(oldAttachmentPath));
    }

    const settings = getSettings(app);
    for (const parentFolder of parentFolders) {
      switch (settings.emptyAttachmentFolderBehavior) {
        case EmptyAttachmentFolderBehavior.Delete:
          await deleteSafe(app, parentFolder, undefined, undefined, true);
          break;
        case EmptyAttachmentFolderBehavior.DeleteWithEmptyParents:
          await deleteEmptyFolderHierarchy(app, parentFolder);
          break;
        default:
          break;
      }
    }

    for (
      const [newBacklinkPath, linkJsonToPathMap] of Array.from(combinedBacklinksMap.entries()).concat(
        Array.from(interruptedCombinedBacklinksMap?.entries() ?? [])
      )
    ) {
      await editLinks(app, newBacklinkPath, (link) => {
        const oldAttachmentPath = linkJsonToPathMap.get(toJson(link));
        if (!oldAttachmentPath) {
          return;
        }

        const newAttachmentPath = renameMap.get(oldAttachmentPath);
        if (!newAttachmentPath) {
          return;
        }

        return updateLink(normalizeOptionalProperties<UpdateLinkOptions>({
          app,
          link,
          newSourcePathOrFile: newBacklinkPath,
          newTargetPathOrFile: newAttachmentPath,
          oldTargetPathOrFile: oldAttachmentPath,
          shouldUpdateFilenameAlias: settings.shouldUpdateFilenameAliases
        }));
      }, {
        shouldFailOnMissingFile: false
      });
    }

    if (isNoteEx(app, newPath)) {
      await updateLinksInFile(normalizeOptionalProperties<UpdateLinksInFileOptions>({
        app,
        newSourcePathOrFile: newPath,
        oldSourcePathOrFile: oldPath,
        shouldFailOnMissingFile: false,
        shouldUpdateFilenameAlias: settings.shouldUpdateFilenameAliases
      }));
    }

    if (!getFileOrNull(app, newPath)) {
      let interruptedRenames = interruptedRenamesMap.get(newPath);
      if (!interruptedRenames) {
        interruptedRenames = [];
        interruptedRenamesMap.set(newPath, interruptedRenames);
      }
      interruptedRenames.push({
        combinedBacklinksMap,
        oldPath
      });
    }
  } finally {
    const orphanKeys = Array.from(handledRenames);
    addToQueue(app, () => {
      for (const key of orphanKeys) {
        handledRenames.delete(key);
      }
    });
  }
}

function handleRenameIfEnabled(plugin: Plugin, file: TAbstractFile, oldPath: string): void {
  if (!shouldInvokeHandler(plugin)) {
    return;
  }
  if (!isFile(file)) {
    return;
  }
  const newPath = file.path;
  handleRename(plugin.app, oldPath, newPath);
}

function initBacklinksMap(
  singleBacklinksMap: Map<string, Reference[]>,
  renameMap: Map<string, string>,
  combinedBacklinksMap: Map<string, Map<string, string>>,
  path: string
): void {
  for (const [backlinkPath, links] of singleBacklinksMap.entries()) {
    const newBacklinkPath = renameMap.get(backlinkPath) ?? backlinkPath;
    const linkJsonToPathMap = combinedBacklinksMap.get(newBacklinkPath) ?? new Map<string, string>();
    combinedBacklinksMap.set(newBacklinkPath, linkJsonToPathMap);
    for (const link of links) {
      linkJsonToPathMap.set(toJson(link), path);
    }
  }
}

function isNoteEx(app: App, path: string): boolean {
  const settings = getSettings(app);
  return settings.isNote?.(path) ?? false;
}

function logRegisteredHandlers(app: App): void {
  const renameDeleteHandlersMap = getRenameDeleteHandlersMap(app);
  getLibDebugger('RenameDeleteHandler:logRegisteredHandlers')(
    `Plugins with registered rename/delete handlers: ${JSON.stringify(Array.from(renameDeleteHandlersMap.keys()))}`
  );
}

function makeKey(oldPath: string, newPath: string): string {
  return `${oldPath} -> ${newPath}`;
}

async function refreshLinks(
  app: App,
  oldPath: string,
  newPath: string,
  oldPathBacklinksMap: Map<string, Reference[]>,
  oldPathLinks: Reference[]
): Promise<void> {
  const cache = app.metadataCache.getCache(oldPath) ?? app.metadataCache.getCache(newPath);
  const oldPathLinksRefreshed = cache ? getAllLinks(cache) : [];
  const fakeOldFile = getFile(app, oldPath, true);
  let oldPathBacklinksMapRefreshed = new Map<string, Reference[]>();
  await tempRegisterFileAndRun(app, fakeOldFile, async () => {
    oldPathBacklinksMapRefreshed = (await getBacklinksForFileSafe(app, fakeOldFile)).data;
  });

  for (const link of oldPathLinksRefreshed) {
    if (oldPathLinks.includes(link)) {
      continue;
    }
    oldPathLinks.push(link);
  }

  for (const [backlinkPath, refreshedLinks] of oldPathBacklinksMapRefreshed.entries()) {
    let oldLinks = oldPathBacklinksMap.get(backlinkPath);
    if (!oldLinks) {
      oldLinks = [];
      oldPathBacklinksMap.set(backlinkPath, oldLinks);
    }

    for (const link of refreshedLinks) {
      if (oldLinks.includes(link)) {
        continue;
      }
      oldLinks.push(link);
    }
  }
}

async function renameHandled(app: App, oldPath: string, newPath: string): Promise<string> {
  newPath = getSafeRenamePath(app, oldPath, newPath);
  if (oldPath === newPath) {
    return newPath;
  }
  const key = makeKey(oldPath, newPath);
  handledRenames.add(key);
  newPath = await renameSafe(app, oldPath, newPath);
  return newPath;
}

async function runAsyncLinkUpdate(app: App, next: RunAsyncLinkUpdateFn, linkUpdatesHandler: LinkUpdatesHandler): Promise<void> {
  await next.call(app.fileManager, wrappedHandler);

  async function wrappedHandler(linkUpdates: LinkUpdate[]): Promise<void> {
    let isRenameCalled = false;
    const eventRef = app.vault.on('rename', () => {
      isRenameCalled = true;
    });
    try {
      await linkUpdatesHandler(linkUpdates);
    } finally {
      app.vault.offref(eventRef);
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (isRenameCalled) {
      linkUpdates.splice(0);
    }
  }
}

function shouldInvokeHandler(plugin: Plugin): boolean {
  const app = plugin.app;
  const pluginId = plugin.manifest.id;

  const renameDeleteHandlerPluginIds = getRenameDeleteHandlersMap(app);
  const mainPluginId = Array.from(renameDeleteHandlerPluginIds.keys())[0];
  if (mainPluginId !== pluginId) {
    return false;
  }
  return true;
}
