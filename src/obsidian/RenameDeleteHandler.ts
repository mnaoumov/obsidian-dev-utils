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

import { InternalPluginName } from 'obsidian-typings/implementations';

import type {
  UpdateLinkOptions,
  UpdateLinksInFileOptions
} from './Link.ts';

import { abortSignalNever } from '../AbortController.ts';
import { filterInPlace } from '../Array.ts';
import { getLibDebugger } from '../Debug.ts';
import {
  normalizeOptionalProperties,
  toJson
} from '../ObjectUtils.ts';
import {
  basename,
  dirname,
  join
} from '../Path.ts';
import { getObsidianDevUtilsState } from './App.ts';
import {
  getAttachmentFilePath,
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
  tempRegisterFilesAndRun
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
 * A behavior of the rename/delete handler when deleting empty attachment folders.
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
   * A behavior of the rename/delete handler when deleting empty attachment folders.
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
   * Whether to rename attachments when a note is renamed.
   */
  shouldRenameAttachments: boolean;

  /**
   * Whether to update file name aliases when a note is renamed.
   */
  shouldUpdateFileNameAliases: boolean;
}

interface AbortablePlugin extends Plugin {
  abortSignal?: AbortSignal;
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
export function registerRenameDeleteHandlers(plugin: AbortablePlugin, settingsBuilder: () => Partial<RenameDeleteHandlerSettings>): void {
  const renameDeleteHandlersMap = getRenameDeleteHandlersMap(plugin.app);
  const pluginId = plugin.manifest.id;

  renameDeleteHandlersMap.set(pluginId, settingsBuilder);
  logRegisteredHandlers(plugin.app);

  plugin.register(() => {
    renameDeleteHandlersMap.delete(pluginId);
    logRegisteredHandlers(plugin.app);
  });

  const app = plugin.app;
  const abortSignal = plugin.abortSignal ?? abortSignalNever();

  plugin.registerEvent(
    app.vault.on('delete', (file) => {
      handleDeleteIfEnabled(plugin, file, abortSignal);
    })
  );

  plugin.registerEvent(
    app.vault.on('rename', (file, oldPath) => {
      handleRenameIfEnabled(plugin, file, oldPath, abortSignal);
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

async function cleanupParentFolders(app: App, parentFolderPaths: string[], notePath: string): Promise<void> {
  const settings = getSettings(app);
  if (settings.emptyAttachmentFolderBehavior === EmptyAttachmentFolderBehavior.Keep) {
    return;
  }
  for (const parentFolderPath of parentFolderPaths) {
    switch (settings.emptyAttachmentFolderBehavior) {
      case EmptyAttachmentFolderBehavior.Delete:
        await deleteSafe(app, parentFolderPath, notePath, undefined, true);
        break;
      case EmptyAttachmentFolderBehavior.DeleteWithEmptyParents:
        await deleteEmptyFolderHierarchy(app, parentFolderPath);
        break;
      default:
        break;
    }
  }
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

async function fillRenameMap(
  app: App,
  oldPath: string,
  newPath: string,
  renameMap: Map<string, string>,
  oldPathLinks: Reference[],
  abortSignal: AbortSignal
): Promise<void> {
  abortSignal.throwIfAborted();
  renameMap.set(oldPath, newPath);

  if (!isNoteEx(app, oldPath)) {
    return;
  }

  const settings = getSettings(app);

  if (!settings.shouldRenameAttachments) {
    return;
  }

  const oldAttachmentFolderPath = await getAttachmentFolderPath(app, oldPath);
  const isOldAttachmentFolderAtRoot = oldAttachmentFolderPath === '/';

  const oldAttachmentFolder = getFolderOrNull(app, oldAttachmentFolderPath);

  if (!oldAttachmentFolder) {
    return;
  }

  const oldAttachmentFiles: TFile[] = [];

  for (const oldPathLink of oldPathLinks) {
    abortSignal.throwIfAborted();
    const oldAttachmentFile = extractLinkFile(app, oldPathLink, oldPath);
    if (!oldAttachmentFile) {
      continue;
    }

    if (isNoteEx(app, oldAttachmentFile.path)) {
      continue;
    }

    if (isOldAttachmentFolderAtRoot || oldAttachmentFile.path.startsWith(oldAttachmentFolderPath)) {
      const oldAttachmentBacklinks = await getBacklinksForFileSafe(app, oldAttachmentFile);
      abortSignal.throwIfAborted();
      if (oldAttachmentBacklinks.keys().length === 1) {
        oldAttachmentFiles.push(oldAttachmentFile);
      }
    }
  }

  for (const oldAttachmentFile of oldAttachmentFiles) {
    let newAttachmentPath = await getAttachmentFilePath(app, oldAttachmentFile, newPath, true);
    abortSignal.throwIfAborted();
    if (oldAttachmentFile.path === newAttachmentPath) {
      continue;
    }

    if (settings.shouldDeleteConflictingAttachments) {
      const newAttachmentFile = getFileOrNull(app, newAttachmentPath);
      if (newAttachmentFile) {
        console.warn(`Removing conflicting attachment ${newAttachmentFile.path}.`);
        await app.fileManager.trashFile(newAttachmentFile);
      }
    } else {
      const newDir = dirname(newAttachmentPath);
      const newBaseName = basename(newAttachmentPath, oldAttachmentFile.extension ? `.${oldAttachmentFile.extension}` : '');
      newAttachmentPath = app.vault.getAvailablePath(join(newDir, newBaseName), oldAttachmentFile.extension);
    }
    renameMap.set(oldAttachmentFile.path, newAttachmentPath);
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
    settings.shouldRenameAttachments ||= newSettings.shouldRenameAttachments ?? false;
    settings.shouldUpdateFileNameAliases ||= newSettings.shouldUpdateFileNameAliases ?? false;
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

async function handleDelete(app: App, path: string, abortSignal: AbortSignal): Promise<void> {
  abortSignal.throwIfAborted();
  getLibDebugger('RenameDeleteHandler:handleDelete')(`Handle Delete ${path}`);
  if (!isNoteEx(app, path)) {
    return;
  }

  const settings = getSettings(app);
  if (!settings.shouldHandleDeletions) {
    return;
  }

  if (settings.isPathIgnored?.(path)) {
    console.warn(`Skipping delete handler of ${path} as the path is ignored.`);
    return;
  }

  const cache = deletedMetadataCacheMap.get(path);
  deletedMetadataCacheMap.delete(path);
  const parentFolderPaths = new Set<string>();
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

      parentFolderPaths.add(attachmentFile.parent?.path ?? '');
      await deleteSafe(app, attachmentFile, path, false, settings.emptyAttachmentFolderBehavior !== EmptyAttachmentFolderBehavior.Keep);
      abortSignal.throwIfAborted();
    }
  }

  await cleanupParentFolders(app, Array.from(parentFolderPaths), path);
  abortSignal.throwIfAborted();

  const attachmentFolderPath = await getAttachmentFolderPath(app, path);
  const attachmentFolder = getFolderOrNull(app, attachmentFolderPath);

  if (!attachmentFolder) {
    return;
  }

  if (!(await hasOwnAttachmentFolder(app, path))) {
    return;
  }

  abortSignal.throwIfAborted();

  await deleteSafe(app, attachmentFolder, path, false, settings.emptyAttachmentFolderBehavior !== EmptyAttachmentFolderBehavior.Keep);
  abortSignal.throwIfAborted();
}

function handleDeleteIfEnabled(plugin: AbortablePlugin, file: TAbstractFile, abortSignal: AbortSignal): void {
  const app = plugin.app;
  if (!shouldInvokeHandler(plugin)) {
    return;
  }
  const path = file.path;
  addToQueue(app, (abortSignal2) => handleDelete(app, path, abortSignal2), abortSignal);
}

function handleMetadataDeleted(app: App, file: TAbstractFile, prevCache: CachedMetadata | null): void {
  const settings = getSettings(app);
  if (settings.isPathIgnored?.(file.path)) {
    console.warn(`Skipping metadata delete handler of ${file.path} as the path is ignored.`);
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

function handleRename(app: App, oldPath: string, newPath: string, abortSignal: AbortSignal): void {
  const key = makeKey(oldPath, newPath);
  getLibDebugger('RenameDeleteHandler:handleRename')(`Handle Rename ${key}`);
  if (handledRenames.has(key)) {
    handledRenames.delete(key);
    return;
  }

  const settings = getSettings(app);
  if (!settings.shouldHandleRenames) {
    return;
  }

  if (settings.isPathIgnored?.(oldPath)) {
    console.warn(`Skipping rename handler of old path ${oldPath} as the path is ignored.`);
    return;
  }

  if (settings.isPathIgnored?.(newPath)) {
    console.warn(`Skipping rename handler of new path ${newPath} as the path is ignored.`);
    return;
  }

  const cache = app.metadataCache.getCache(oldPath) ?? app.metadataCache.getCache(newPath);
  const oldPathLinks = cache ? getAllLinks(cache) : [];
  const oldPathBacklinksMap = getBacklinksForFileOrPath(app, oldPath).data;
  addToQueue(app, (abortSignal2) => handleRenameAsync(app, oldPath, newPath, oldPathBacklinksMap, oldPathLinks, undefined, abortSignal2), abortSignal);
}

async function handleRenameAsync(
  app: App,
  oldPath: string,
  newPath: string,
  oldPathBacklinksMap: Map<string, Reference[]>,
  oldPathLinks: Reference[],
  interruptedCombinedBacklinksMap?: Map<string, Map<string, string>>,
  abortSignal?: AbortSignal
): Promise<void> {
  abortSignal ??= abortSignalNever();
  abortSignal.throwIfAborted();
  await continueInterruptedRenames(app, oldPath, newPath, oldPathBacklinksMap, oldPathLinks);
  abortSignal.throwIfAborted();
  await refreshLinks(app, oldPath, newPath, oldPathBacklinksMap, oldPathLinks);
  abortSignal.throwIfAborted();
  if (await handleCaseCollision(app, oldPath, newPath, oldPathBacklinksMap, oldPathLinks)) {
    return;
  }

  abortSignal.throwIfAborted();

  try {
    const renameMap = new Map<string, string>();
    await fillRenameMap(app, oldPath, newPath, renameMap, oldPathLinks, abortSignal);
    abortSignal.throwIfAborted();

    const combinedBacklinksMap = new Map<string, Map<string, string>>();
    initBacklinksMap(oldPathBacklinksMap, renameMap, combinedBacklinksMap, oldPath);

    for (const attachmentOldPath of renameMap.keys()) {
      if (attachmentOldPath === oldPath) {
        continue;
      }
      const attachmentOldPathBacklinksMap = (await getBacklinksForFileSafe(app, attachmentOldPath)).data;
      initBacklinksMap(attachmentOldPathBacklinksMap, renameMap, combinedBacklinksMap, attachmentOldPath);
    }

    const parentFolderPaths = new Set<string>();

    for (const [oldAttachmentPath, newAttachmentPath] of renameMap.entries()) {
      if (oldAttachmentPath === oldPath) {
        continue;
      }
      const fixedNewAttachmentPath = await renameHandled(app, oldAttachmentPath, newAttachmentPath);
      renameMap.set(oldAttachmentPath, fixedNewAttachmentPath);
      parentFolderPaths.add(dirname(oldAttachmentPath));
    }

    await cleanupParentFolders(app, Array.from(parentFolderPaths), oldPath);
    abortSignal.throwIfAborted();
    const settings = getSettings(app);

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
          shouldUpdateFileNameAlias: settings.shouldUpdateFileNameAliases
        }));
      }, {
        shouldFailOnMissingFile: false
      });
      abortSignal.throwIfAborted();
    }

    if (isNoteEx(app, newPath)) {
      await updateLinksInFile(normalizeOptionalProperties<UpdateLinksInFileOptions>({
        app,
        newSourcePathOrFile: newPath,
        oldSourcePathOrFile: oldPath,
        shouldFailOnMissingFile: false,
        shouldUpdateFileNameAlias: settings.shouldUpdateFileNameAliases
      }));
      abortSignal.throwIfAborted();
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
    }, abortSignal);
  }
}

function handleRenameIfEnabled(plugin: Plugin, file: TAbstractFile, oldPath: string, abortSignal: AbortSignal): void {
  if (!shouldInvokeHandler(plugin)) {
    return;
  }
  if (!isFile(file)) {
    return;
  }
  const newPath = file.path;
  handleRename(plugin.app, oldPath, newPath, abortSignal);
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
  await tempRegisterFilesAndRun(app, [fakeOldFile], async () => {
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
    const settings = getSettings(app);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (isRenameCalled && settings.shouldHandleRenames) {
      filterInPlace(
        linkUpdates,
        (linkUpdate) => {
          if (settings.isPathIgnored?.(linkUpdate.sourceFile.path)) {
            console.warn(`Roll back to default link update of source file ${linkUpdate.sourceFile.path} as the path is ignored.`);
            return true;
          }

          if (settings.isPathIgnored?.(linkUpdate.resolvedFile.path)) {
            console.warn(`Roll back to default link update of resolved file ${linkUpdate.resolvedFile.path} as the path is ignored.`);
            return true;
          }

          if (!app.internalPlugins.getEnabledPluginById(InternalPluginName.Canvas)) {
            return false;
          }

          if (app.plugins.getPlugin('backlink-cache')) {
            return false;
          }

          if (linkUpdate.sourceFile.extension === 'canvas') {
            return true;
          }

          if (linkUpdate.resolvedFile.extension === 'canvas') {
            return true;
          }

          return false;
        }
      );
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
