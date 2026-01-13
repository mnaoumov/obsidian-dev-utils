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

import { t } from 'i18next';
import {
  Notice,
  Vault
} from 'obsidian';
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
  extname,
  join,
  relative
} from '../Path.ts';
import { getObsidianDevUtilsState } from './App.ts';
import {
  AttachmentPathContext,
  getAttachmentFilePath,
  getAttachmentFolderPath,
  hasOwnAttachmentFolder
} from './AttachmentPath.ts';
import {
  CANVAS_FILE_EXTENSION,
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
  registerFileCacheForNonExistingFile,
  tempRegisterFilesAndRun,
  tempRegisterFilesAndRunAsync,
  unregisterFileCacheForNonExistingFile
} from './MetadataCache.ts';
import { registerPatch } from './MonkeyAround.ts';
import { addToQueue } from './Queue.ts';
import {
  getSafeRenamePath,
  renameSafe
} from './Vault.ts';
import {
  deleteEmptyFolder,
  deleteEmptyFolderHierarchy,
  deleteSafe
} from './VaultEx.ts';

/**
 * A behavior of the rename/delete handler when deleting empty folders.
 */
export enum EmptyFolderBehavior {
  /**
   * Delete the empty folder.
   */
  Delete = 'Delete',

  /**
   * Delete the empty folder and all its empty parents.
   */
  DeleteWithEmptyParents = 'DeleteWithEmptyParents',

  /**
   * Keep the empty folder.
   */
  Keep = 'Keep'
}

/**
 * Settings for the rename/delete handler.
 */
export interface RenameDeleteHandlerSettings {
  /**
   * A behavior of the rename/delete handler when deleting empty folders.
   */
  emptyFolderBehavior: EmptyFolderBehavior;

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
   * Whether to update file name aliases when a note is renamed.
   */
  shouldUpdateFileNameAliases: boolean;
}

interface AbortablePlugin extends Plugin {
  abortSignal?: AbortSignal;
}

interface HandledRenameKey {
  newPath: string;
  oldPath: string;
}

interface InterruptedRename {
  combinedBacklinksMap: Map<string, Map<string, string>>;
  oldPath: string;
}

interface RenameHandlerOptions {
  abortSignal: AbortSignal;
  app: App;
  handledRenames: HandledRenames;
  interruptedCombinedBacklinksMap?: Map<string, Map<string, string>>;
  interruptedRenamesMap: Map<string, InterruptedRename[]>;
  newPath: string;
  oldCache: CachedMetadata | null;
  oldPath: string;
  oldPathBacklinksMap: Map<string, Reference[]>;
  settingsManager: SettingsManager;
}

interface RenameMapOptions {
  abortSignal: AbortSignal;
  app: App;
  newPath: string;
  oldCache: CachedMetadata | null;
  oldPath: string;
  settingsManager: SettingsManager;
}

type RunAsyncLinkUpdateFn = { renameDeleteHandlerPatched?: boolean } & FileManager['runAsyncLinkUpdate'];

class DeleteHandler {
  public constructor(
    private readonly app: App,
    private readonly file: TAbstractFile,
    private readonly abortSignal: AbortSignal,
    private readonly settingsManager: SettingsManager,
    private readonly deletedMetadataCacheMap: Map<string, CachedMetadata>
  ) {
  }

  public async handle(): Promise<void> {
    this.abortSignal.throwIfAborted();
    getLibDebugger('RenameDeleteHandler:handleDelete')(`Handle Delete ${this.file.path}`);
    if (!isNote(this.app, this.file)) {
      return;
    }

    const settings = this.settingsManager.getSettings();
    if (!settings.shouldHandleDeletions) {
      return;
    }

    if (settings.isPathIgnored?.(this.file.path)) {
      getLibDebugger('RenameDeleteHandler:handleDelete')(`Skipping delete handler of ${this.file.path} as the path is ignored.`);
      return;
    }

    const cache = this.deletedMetadataCacheMap.get(this.file.path);
    this.deletedMetadataCacheMap.delete(this.file.path);
    const parentFolderPaths = new Set<string>();
    if (cache) {
      const links = getAllLinks(cache);

      for (const link of links) {
        const attachmentFile = extractLinkFile(this.app, link, this.file.path);
        if (!attachmentFile) {
          continue;
        }

        if (this.settingsManager.isNoteEx(attachmentFile.path)) {
          continue;
        }

        parentFolderPaths.add(attachmentFile.parent?.path ?? '');
        await deleteSafe(this.app, attachmentFile, this.file.path, false, settings.emptyFolderBehavior !== EmptyFolderBehavior.Keep);
      }
    }

    await cleanupParentFolders(this.app, this.settingsManager.getSettings(), Array.from(parentFolderPaths));
    this.abortSignal.throwIfAborted();

    const attachmentFolderPath = await getAttachmentFolderPath(this.app, this.file.path, AttachmentPathContext.DeleteNote);
    const attachmentFolder = getFolderOrNull(this.app, attachmentFolderPath);

    if (!attachmentFolder) {
      return;
    }

    if (!(await hasOwnAttachmentFolder(this.app, this.file.path, AttachmentPathContext.DeleteNote))) {
      return;
    }

    this.abortSignal.throwIfAborted();

    await deleteSafe(this.app, attachmentFolder, this.file.path, false, settings.emptyFolderBehavior !== EmptyFolderBehavior.Keep);
    this.abortSignal.throwIfAborted();
  }
}

class HandledRenames {
  private readonly map = new Map<string, HandledRenameKey>();

  public add(oldPath: string, newPath: string): void {
    this.map.set(this.keyToString(oldPath, newPath), { newPath, oldPath });
  }

  public delete(oldPath: string, newPath: string): void {
    this.map.delete(this.keyToString(oldPath, newPath));
  }

  public has(oldPath: string, newPath: string): boolean {
    return this.map.has(this.keyToString(oldPath, newPath));
  }

  public keys(): IterableIterator<HandledRenameKey> {
    return this.map.values();
  }

  private keyToString(oldPath: string, newPath: string): string {
    return `${oldPath} -> ${newPath}`;
  }
}

class MetadataDeletedHandler {
  public constructor(
    private readonly app: App,
    private readonly file: TAbstractFile,
    private readonly prevCache: CachedMetadata | null,
    private readonly settingsManager: SettingsManager,
    private readonly deletedMetadataCacheMap: Map<string, CachedMetadata>
  ) {
  }

  public handle(): void {
    const settings = this.settingsManager.getSettings();

    if (!settings.shouldHandleDeletions) {
      return;
    }

    if (settings.isPathIgnored?.(this.file.path)) {
      getLibDebugger('RenameDeleteHandler:handleMetadataDeleted')(`Skipping metadata delete handler of ${this.file.path} as the path is ignored.`);
      return;
    }

    if (isMarkdownFile(this.app, this.file) && this.prevCache) {
      this.deletedMetadataCacheMap.set(this.file.path, this.prevCache);
    }
  }
}

class Registry {
  private readonly abortSignal: AbortSignal;
  private readonly app: App;
  private readonly deletedMetadataCacheMap = new Map<string, CachedMetadata>();
  private readonly handledRenames = new HandledRenames();
  private readonly interruptedRenamesMap = new Map<string, InterruptedRename[]>();
  private readonly pluginId: string;

  public constructor(
    private readonly plugin: AbortablePlugin,
    private readonly settingsBuilder: () => Partial<RenameDeleteHandlerSettings>,
    private readonly settingsManager: SettingsManager
  ) {
    this.app = plugin.app;
    this.pluginId = plugin.manifest.id;
    this.abortSignal = plugin.abortSignal ?? abortSignalNever();
  }

  public register(): void {
    const renameDeleteHandlersMap = this.settingsManager.renameDeleteHandlersMap;

    renameDeleteHandlersMap.set(this.pluginId, this.settingsBuilder);
    this.logRegisteredHandlers();

    this.plugin.register(() => {
      renameDeleteHandlersMap.delete(this.pluginId);
      this.logRegisteredHandlers();
    });

    this.plugin.registerEvent(this.app.vault.on('delete', this.handleDelete.bind(this)));
    this.plugin.registerEvent(this.app.vault.on('rename', this.handleRename.bind(this)));
    this.plugin.registerEvent(this.app.metadataCache.on('deleted', this.handleMetadataDeleted.bind(this)));

    registerPatch(this.plugin, this.app.fileManager, {
      runAsyncLinkUpdate: (next: RunAsyncLinkUpdateFn): RunAsyncLinkUpdateFn => {
        return Object.assign((linkUpdatesHandler) => this.runAsyncLinkUpdate(next, linkUpdatesHandler), { renameDeleteHandlerPatched: true });
      }
    });
  }

  private handleDelete(file: TAbstractFile): void {
    if (!this.shouldInvokeHandler()) {
      return;
    }
    addToQueue({
      app: this.app,
      operationFn: (abortSignal) => new DeleteHandler(this.app, file, abortSignal, this.settingsManager, this.deletedMetadataCacheMap).handle(),
      operationName: t(($) => $.obsidianDevUtils.renameDeleteHandler.handleDelete, { filePath: file.path })
    });
  }

  private handleMetadataDeleted(file: TAbstractFile, prevCache: CachedMetadata | null): void {
    if (!this.shouldInvokeHandler()) {
      return;
    }
    new MetadataDeletedHandler(this.app, file, prevCache, this.settingsManager, this.deletedMetadataCacheMap).handle();
  }

  private handleRename(file: TAbstractFile, oldPath: string): void {
    if (!this.shouldInvokeHandler()) {
      return;
    }

    if (!isFile(file)) {
      return;
    }

    const newPath = file.path;

    getLibDebugger('RenameDeleteHandler:handleRename')(`Handle Rename ${oldPath} -> ${newPath}`);
    if (this.handledRenames.has(oldPath, newPath)) {
      this.handledRenames.delete(oldPath, newPath);
      return;
    }

    const settings = this.settingsManager.getSettings();
    if (!settings.shouldHandleRenames) {
      return;
    }

    if (settings.isPathIgnored?.(oldPath)) {
      getLibDebugger('RenameDeleteHandler:handleRename')(`Skipping rename handler of old path ${oldPath} as the path is ignored.`);
      return;
    }

    if (settings.isPathIgnored?.(newPath)) {
      getLibDebugger('RenameDeleteHandler:handleRename')(`Skipping rename handler of new path ${newPath} as the path is ignored.`);
      return;
    }

    const oldCache = this.app.metadataCache.getCache(oldPath) ?? this.app.metadataCache.getCache(newPath);
    const oldPathBacklinksMap = getBacklinksForFileOrPath(this.app, oldPath).data;
    addToQueue({
      abortSignal: this.abortSignal,
      app: this.app,
      operationFn: (abortSignal) =>
        new RenameHandler({
          abortSignal,
          app: this.app,
          handledRenames: this.handledRenames,
          interruptedRenamesMap: this.interruptedRenamesMap,
          newPath,
          oldCache,
          oldPath,
          oldPathBacklinksMap,
          settingsManager: this.settingsManager
        }).handle(),
      operationName: t(($) => $.obsidianDevUtils.renameDeleteHandler.handleRename, { newPath, oldPath })
    });
  }

  private logRegisteredHandlers(): void {
    const renameDeleteHandlersMap = this.settingsManager.renameDeleteHandlersMap;
    getLibDebugger('RenameDeleteHandler:logRegisteredHandlers')(
      `Plugins with registered rename/delete handlers: ${JSON.stringify(Array.from(renameDeleteHandlersMap.keys()))}`
    );
  }

  private async runAsyncLinkUpdate(next: RunAsyncLinkUpdateFn, linkUpdatesHandler: LinkUpdatesHandler): Promise<void> {
    if (next.renameDeleteHandlerPatched) {
      await next.call(this.app.fileManager, linkUpdatesHandler);
      return;
    }
    await next.call(this.app.fileManager, (linkUpdates) => this.wrapLinkUpdatesHandler(linkUpdates, linkUpdatesHandler));
  }

  private shouldInvokeHandler(): boolean {
    const pluginId = this.plugin.manifest.id;

    const renameDeleteHandlersMap = this.settingsManager.renameDeleteHandlersMap;
    const mainPluginId = Array.from(renameDeleteHandlersMap.keys())[0];
    return mainPluginId === pluginId;
  }

  private async wrapLinkUpdatesHandler(linkUpdates: LinkUpdate[], linkUpdatesHandler: LinkUpdatesHandler): Promise<void> {
    let isRenameCalled = false;
    const eventRef = this.app.vault.on('rename', () => {
      isRenameCalled = true;
    });
    try {
      await linkUpdatesHandler(linkUpdates);
    } finally {
      this.app.vault.offref(eventRef);
    }
    const settings = this.settingsManager.getSettings();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- It might changed in `rename` event handler. ESLint mistakenly does not recognize it.
    if (!isRenameCalled || !settings.shouldHandleRenames) {
      return;
    }

    filterInPlace(
      linkUpdates,
      (linkUpdate) => {
        if (settings.isPathIgnored?.(linkUpdate.sourceFile.path)) {
          getLibDebugger('RenameDeleteHandler:runAsyncLinkUpdate')(
            `Roll back to default link update of source file ${linkUpdate.sourceFile.path} as the path is ignored.`
          );
          return true;
        }

        if (settings.isPathIgnored?.(linkUpdate.resolvedFile.path)) {
          getLibDebugger('RenameDeleteHandler:runAsyncLinkUpdate')(
            `Roll back to default link update of resolved file ${linkUpdate.resolvedFile.path} as the path is ignored.`
          );
          return true;
        }

        if (!this.app.internalPlugins.getEnabledPluginById(InternalPluginName.Canvas)) {
          return false;
        }

        if (this.app.plugins.getPlugin('backlink-cache')) {
          return false;
        }

        if (linkUpdate.sourceFile.extension === CANVAS_FILE_EXTENSION) {
          return true;
        }

        if (linkUpdate.resolvedFile.extension === CANVAS_FILE_EXTENSION) {
          return true;
        }

        return false;
      }
    );
  }
}

class RenameHandler {
  private readonly abortSignal: AbortSignal;
  private readonly app: App;
  private readonly handledRenames: HandledRenames;
  private readonly interruptedCombinedBacklinksMap: Map<string, Map<string, string>>;
  private readonly interruptedRenamesMap: Map<string, InterruptedRename[]>;
  private readonly newPath: string;
  private readonly oldCache: CachedMetadata | null;
  private readonly oldPath: string;
  private readonly oldPathBacklinksMap: Map<string, Reference[]>;
  private readonly oldPathLinks: Reference[];
  private readonly settingsManager: SettingsManager;

  public constructor(options: RenameHandlerOptions) {
    this.app = options.app;
    this.oldPath = options.oldPath;
    this.newPath = options.newPath;
    this.oldPathBacklinksMap = options.oldPathBacklinksMap;
    this.oldCache = options.oldCache;
    this.abortSignal = options.abortSignal;
    this.settingsManager = options.settingsManager;
    this.interruptedRenamesMap = options.interruptedRenamesMap;
    this.oldPathLinks = this.oldCache ? getAllLinks(this.oldCache) : [];
    this.handledRenames = options.handledRenames;
    this.interruptedCombinedBacklinksMap = options.interruptedCombinedBacklinksMap ?? new Map<string, Map<string, string>>();
  }

  public async handle(): Promise<void> {
    if (this.oldPath === this.newPath) {
      return;
    }
    this.abortSignal.throwIfAborted();
    await this.continueInterruptedRenames();
    this.abortSignal.throwIfAborted();
    await this.refreshLinks();
    this.abortSignal.throwIfAborted();
    if (await this.handleCaseCollision()) {
      return;
    }

    this.abortSignal.throwIfAborted();

    const renamedFilePaths = getObsidianDevUtilsState(this.app, 'renamedFilePaths', new Set<string>()).value;
    const renamedLinks = getObsidianDevUtilsState(this.app, 'renamedLinkPaths', new Set<string>()).value;

    try {
      const renameMap = new RenameMap({
        abortSignal: this.abortSignal,
        app: this.app,
        newPath: this.newPath,
        oldCache: this.oldCache,
        oldPath: this.oldPath,
        settingsManager: this.settingsManager
      });
      await renameMap.fill();
      this.abortSignal.throwIfAborted();

      const combinedBacklinksMap = new Map<string, Map<string, string>>();
      renameMap.initOriginalLinksMap(combinedBacklinksMap);
      renameMap.initBacklinksMap(this.oldPathBacklinksMap, combinedBacklinksMap, this.oldPath);

      for (const attachmentOldPath of renameMap.keys()) {
        if (attachmentOldPath === this.oldPath) {
          continue;
        }
        const attachmentOldPathBacklinksMap = (await getBacklinksForFileSafe(this.app, attachmentOldPath)).data;
        this.abortSignal.throwIfAborted();
        renameMap.initBacklinksMap(attachmentOldPathBacklinksMap, combinedBacklinksMap, attachmentOldPath);
      }

      const parentFolderPaths = new Set<string>();

      for (const [oldAttachmentPath, newAttachmentPath] of renameMap.entries()) {
        if (oldAttachmentPath !== this.oldPath) {
          const fixedNewAttachmentPath = await this.renameHandled(oldAttachmentPath, newAttachmentPath);
          this.abortSignal.throwIfAborted();
          renameMap.set(oldAttachmentPath, fixedNewAttachmentPath);
        }
        if (!this.settingsManager.isNoteEx(oldAttachmentPath)) {
          parentFolderPaths.add(dirname(oldAttachmentPath));
        }
      }

      await cleanupParentFolders(this.app, this.settingsManager.getSettings(), Array.from(parentFolderPaths));
      this.abortSignal.throwIfAborted();
      const settings = this.settingsManager.getSettings();

      for (
        const [newBacklinkPath, linkJsonToPathMap] of Array.from(combinedBacklinksMap.entries()).concat(
          Array.from(this.interruptedCombinedBacklinksMap.entries())
        )
      ) {
        let linkIndex = 0;
        await editLinks(this.app, newBacklinkPath, (link) => {
          linkIndex++;
          const oldAttachmentPath = linkJsonToPathMap.get(toJson(link));
          if (!oldAttachmentPath) {
            return;
          }

          const newAttachmentPath = renameMap.get(oldAttachmentPath) ?? oldAttachmentPath;

          renamedFilePaths.add(newBacklinkPath);
          renamedLinks.add(`${newBacklinkPath}//${String(linkIndex)}`);

          return updateLink(normalizeOptionalProperties<UpdateLinkOptions>({
            app: this.app,
            link,
            newSourcePathOrFile: newBacklinkPath,
            newTargetPathOrFile: newAttachmentPath,
            oldTargetPathOrFile: oldAttachmentPath,
            shouldUpdateFileNameAlias: settings.shouldUpdateFileNameAliases
          }));
        }, {
          shouldFailOnMissingFile: false
        });
        this.abortSignal.throwIfAborted();
      }

      if (isNote(this.app, this.newPath)) {
        await updateLinksInFile(normalizeOptionalProperties<UpdateLinksInFileOptions>({
          app: this.app,
          newSourcePathOrFile: this.newPath,
          oldSourcePathOrFile: this.oldPath,
          shouldFailOnMissingFile: false,
          shouldUpdateFileNameAlias: settings.shouldUpdateFileNameAliases
        }));
        this.abortSignal.throwIfAborted();
      }

      if (!getFileOrNull(this.app, this.newPath)) {
        let interruptedRenames = this.interruptedRenamesMap.get(this.newPath);
        if (!interruptedRenames) {
          interruptedRenames = [];
          this.interruptedRenamesMap.set(this.newPath, interruptedRenames);
        }
        interruptedRenames.push({
          combinedBacklinksMap,
          oldPath: this.oldPath
        });
      }
    } finally {
      const orphanKeys = Array.from(this.handledRenames.keys());
      addToQueue({
        abortSignal: this.abortSignal,
        app: this.app,
        operationFn: () => {
          for (const orphanKey of orphanKeys) {
            this.handledRenames.delete(orphanKey.oldPath, orphanKey.newPath);
          }

          if (renamedLinks.size === 0) {
            return;
          }
          new Notice(t(($) => $.obsidianDevUtils.renameDeleteHandler.updatedLinks, { filesCount: renamedFilePaths.size, linksCount: renamedLinks.size }));
          renamedFilePaths.clear();
          renamedLinks.clear();
        },
        operationName: t(($) => $.obsidianDevUtils.renameDeleteHandler.handleOrphanedRenames)
      });
    }
  }

  private async continueInterruptedRenames(): Promise<void> {
    const interruptedRenames = this.interruptedRenamesMap.get(this.oldPath);
    if (interruptedRenames) {
      this.interruptedRenamesMap.delete(this.oldPath);
      for (const interruptedRename of interruptedRenames) {
        await new RenameHandler({
          abortSignal: this.abortSignal,
          app: this.app,
          handledRenames: this.handledRenames,
          interruptedCombinedBacklinksMap: interruptedRename.combinedBacklinksMap,
          interruptedRenamesMap: this.interruptedRenamesMap,
          newPath: this.newPath,
          oldCache: this.oldCache,
          oldPath: interruptedRename.oldPath,
          oldPathBacklinksMap: this.oldPathBacklinksMap,
          settingsManager: this.settingsManager
        }).handle();
      }
    }
  }

  private async handleCaseCollision(): Promise<boolean> {
    if (!this.app.vault.adapter.insensitive || this.oldPath.toLowerCase() !== this.newPath.toLowerCase()) {
      return false;
    }

    const tempPath = join(dirname(this.newPath), `__temp__${basename(this.newPath)}`);
    await this.renameHandled(this.newPath, tempPath);

    await new RenameHandler({
      abortSignal: this.abortSignal,
      app: this.app,
      handledRenames: this.handledRenames,
      interruptedRenamesMap: this.interruptedRenamesMap,
      newPath: tempPath,
      oldCache: this.oldCache,
      oldPath: this.oldPath,
      oldPathBacklinksMap: this.oldPathBacklinksMap,
      settingsManager: this.settingsManager
    }).handle();

    await this.app.fileManager.renameFile(getFile(this.app, tempPath), this.newPath);
    return true;
  }

  private async refreshLinks(): Promise<void> {
    const cache = this.app.metadataCache.getCache(this.oldPath) ?? this.app.metadataCache.getCache(this.newPath);
    const oldPathLinksRefreshed = cache ? getAllLinks(cache) : [];
    const fakeOldFile = getFile(this.app, this.oldPath, true);
    let oldPathBacklinksMapRefreshed = new Map<string, Reference[]>();
    await tempRegisterFilesAndRun(this.app, [fakeOldFile], async () => {
      oldPathBacklinksMapRefreshed = (await getBacklinksForFileSafe(this.app, fakeOldFile)).data;
    });

    for (const link of oldPathLinksRefreshed) {
      if (this.oldPathLinks.includes(link)) {
        continue;
      }
      this.oldPathLinks.push(link);
    }

    for (const [backlinkPath, refreshedLinks] of oldPathBacklinksMapRefreshed.entries()) {
      let oldLinks = this.oldPathBacklinksMap.get(backlinkPath);
      if (!oldLinks) {
        oldLinks = [];
        this.oldPathBacklinksMap.set(backlinkPath, oldLinks);
      }

      for (const link of refreshedLinks) {
        if (oldLinks.includes(link)) {
          continue;
        }
        oldLinks.push(link);
      }
    }
  }

  private async renameHandled(oldPath: string, newPath: string): Promise<string> {
    newPath = getSafeRenamePath(this.app, oldPath, newPath);
    if (oldPath === newPath) {
      return newPath;
    }
    this.handledRenames.add(oldPath, newPath);
    newPath = await renameSafe(this.app, oldPath, newPath);
    return newPath;
  }
}

class RenameMap {
  private readonly abortSignal: AbortSignal;
  private readonly app: App;
  private readonly map = new Map<string, string>();
  private readonly newPath: string;
  private readonly oldCache: CachedMetadata | null;
  private readonly oldPath: string;
  private readonly oldPathLinks: Reference[];
  private readonly settingsManager: SettingsManager;

  public constructor(options: RenameMapOptions) {
    this.abortSignal = options.abortSignal;
    this.app = options.app;
    this.settingsManager = options.settingsManager;
    this.oldCache = options.oldCache;
    this.oldPath = options.oldPath;
    this.newPath = options.newPath;
    this.oldPathLinks = this.oldCache ? getAllLinks(this.oldCache) : [];
  }

  public entries(): IterableIterator<[string, string]> {
    return this.map.entries();
  }

  public async fill(): Promise<void> {
    this.abortSignal.throwIfAborted();
    this.map.set(this.oldPath, this.newPath);

    if (!isNote(this.app, this.oldPath)) {
      return;
    }

    const settings = this.settingsManager.getSettings();

    const oldFile = getFile(this.app, this.oldPath, true);
    let oldAttachmentFolderPath = '';
    await tempRegisterFilesAndRunAsync(this.app, [oldFile], async () => {
      const shouldFakeOldPathCache = this.oldCache && oldFile.deleted;
      if (shouldFakeOldPathCache) {
        registerFileCacheForNonExistingFile(this.app, oldFile, this.oldCache);
      }

      try {
        oldAttachmentFolderPath = await getAttachmentFolderPath(this.app, this.oldPath, AttachmentPathContext.RenameNote);
      } finally {
        if (shouldFakeOldPathCache) {
          unregisterFileCacheForNonExistingFile(this.app, oldFile);
        }
      }
    });

    const newAttachmentFolderPath = settings.shouldRenameAttachmentFolder
      ? await getAttachmentFolderPath(this.app, this.newPath, AttachmentPathContext.RenameNote)
      : oldAttachmentFolderPath;

    const isOldAttachmentFolderAtRoot = oldAttachmentFolderPath === '/';

    const oldAttachmentFolder = getFolderOrNull(this.app, oldAttachmentFolderPath);

    if (!oldAttachmentFolder) {
      return;
    }

    if (oldAttachmentFolderPath === newAttachmentFolderPath && !settings.shouldRenameAttachmentFiles) {
      return;
    }

    const oldAttachmentFiles: TFile[] = [];

    if (await hasOwnAttachmentFolder(this.app, this.oldPath, AttachmentPathContext.RenameNote)) {
      Vault.recurseChildren(oldAttachmentFolder, (oldAttachmentFile) => {
        this.abortSignal.throwIfAborted();
        if (isFile(oldAttachmentFile)) {
          oldAttachmentFiles.push(oldAttachmentFile);
        }
      });
    } else {
      for (const oldPathLink of this.oldPathLinks) {
        this.abortSignal.throwIfAborted();
        const oldAttachmentFile = extractLinkFile(this.app, oldPathLink, this.oldPath);
        if (!oldAttachmentFile) {
          continue;
        }

        if (isOldAttachmentFolderAtRoot || oldAttachmentFile.path.startsWith(oldAttachmentFolderPath)) {
          const oldAttachmentBacklinks = await getBacklinksForFileSafe(this.app, oldAttachmentFile);
          this.abortSignal.throwIfAborted();
          const keys = new Set<string>(oldAttachmentBacklinks.keys());
          keys.delete(this.oldPath);
          keys.delete(this.newPath);
          if (keys.size === 0) {
            oldAttachmentFiles.push(oldAttachmentFile);
          }
        }
      }
    }

    for (const oldAttachmentFile of oldAttachmentFiles) {
      this.abortSignal.throwIfAborted();
      if (this.settingsManager.isNoteEx(oldAttachmentFile.path)) {
        continue;
      }

      let newAttachmentFilePath: string;
      if (settings.shouldRenameAttachmentFiles) {
        newAttachmentFilePath = await getAttachmentFilePath({
          app: this.app,
          context: AttachmentPathContext.RenameNote,
          notePathOrFile: this.newPath,
          oldAttachmentPathOrFile: oldAttachmentFile,
          oldNotePathOrFile: this.oldPath,
          shouldSkipDuplicateCheck: true
        });
        this.abortSignal.throwIfAborted();
      } else {
        const relativePath = isOldAttachmentFolderAtRoot ? oldAttachmentFile.path : relative(oldAttachmentFolderPath, oldAttachmentFile.path);
        const newFolder = join(newAttachmentFolderPath, dirname(relativePath));
        newAttachmentFilePath = join(newFolder, oldAttachmentFile.name);
      }

      if (oldAttachmentFile.path === newAttachmentFilePath) {
        continue;
      }
      if (settings.shouldDeleteConflictingAttachments) {
        const newAttachmentFile = getFileOrNull(this.app, newAttachmentFilePath);
        if (newAttachmentFile) {
          getLibDebugger('RenameDeleteHandler:fillRenameMap')(`Removing conflicting attachment ${newAttachmentFile.path}.`);
          await this.app.fileManager.trashFile(newAttachmentFile);
          this.abortSignal.throwIfAborted();
        }
      } else {
        const dir = dirname(newAttachmentFilePath);
        const ext = extname(newAttachmentFilePath);
        const baseName = basename(newAttachmentFilePath, ext);
        newAttachmentFilePath = this.app.vault.getAvailablePath(join(dir, baseName), ext.slice(1));
      }
      this.map.set(oldAttachmentFile.path, newAttachmentFilePath);
    }
  }

  public get(oldPath: string): string | undefined {
    return this.map.get(oldPath);
  }

  public initBacklinksMap(
    singleBacklinksMap: Map<string, Reference[]>,
    combinedBacklinksMap: Map<string, Map<string, string>>,
    path: string
  ): void {
    for (const [backlinkPath, links] of singleBacklinksMap.entries()) {
      const newBacklinkPath = this.map.get(backlinkPath) ?? backlinkPath;
      const linkJsonToPathMap = combinedBacklinksMap.get(newBacklinkPath) ?? new Map<string, string>();
      combinedBacklinksMap.set(newBacklinkPath, linkJsonToPathMap);
      for (const link of links) {
        linkJsonToPathMap.set(toJson(link), path);
      }
    }
  }

  public initOriginalLinksMap(combinedBacklinksMap: Map<string, Map<string, string>>): void {
    for (const oldPathLink of this.oldPathLinks) {
      const oldAttachmentFile = extractLinkFile(this.app, oldPathLink, this.oldPath);
      if (!oldAttachmentFile) {
        continue;
      }
      const backlinksMap = new Map<string, Reference[]>();
      backlinksMap.set(this.newPath, [oldPathLink]);
      this.initBacklinksMap(backlinksMap, combinedBacklinksMap, oldAttachmentFile.path);
    }
  }

  public keys(): IterableIterator<string> {
    return this.map.keys();
  }

  public set(oldPath: string, newPath: string): void {
    this.map.set(oldPath, newPath);
  }
}

class SettingsManager {
  public readonly renameDeleteHandlersMap: Map<string, () => Partial<RenameDeleteHandlerSettings>>;

  public constructor(private readonly app: App) {
    this.renameDeleteHandlersMap =
      getObsidianDevUtilsState(app, 'renameDeleteHandlersMap', new Map<string, () => Partial<RenameDeleteHandlerSettings>>()).value;
  }

  public getSettings(): Partial<RenameDeleteHandlerSettings> {
    const settingsBuilders = Array.from(this.renameDeleteHandlersMap.values()).reverse();

    const settings: Partial<RenameDeleteHandlerSettings> = {};
    settings.isNote = (path: string): boolean => isNote(this.app, path);
    settings.isPathIgnored = (): boolean => false;

    for (const settingsBuilder of settingsBuilders) {
      const newSettings = settingsBuilder();
      settings.shouldDeleteConflictingAttachments ||= newSettings.shouldDeleteConflictingAttachments ?? false;
      if (newSettings.emptyFolderBehavior) {
        settings.emptyFolderBehavior ??= newSettings.emptyFolderBehavior;
      }
      settings.shouldHandleDeletions ||= newSettings.shouldHandleDeletions ?? false;
      settings.shouldHandleRenames ||= newSettings.shouldHandleRenames ?? false;
      settings.shouldRenameAttachmentFiles ||= newSettings.shouldRenameAttachmentFiles ?? false;
      settings.shouldRenameAttachmentFolder ||= newSettings.shouldRenameAttachmentFolder ?? false;
      settings.shouldUpdateFileNameAliases ||= newSettings.shouldUpdateFileNameAliases ?? false;
      const isPathIgnored = settings.isPathIgnored;
      settings.isPathIgnored = (path: string): boolean => isPathIgnored(path) || (newSettings.isPathIgnored?.(path) ?? false);
      const currentIsNote = settings.isNote;
      settings.isNote = (path: string): boolean => currentIsNote(path) && (newSettings.isNote?.(path) ?? true);
    }

    settings.emptyFolderBehavior ??= EmptyFolderBehavior.Keep;
    return settings;
  }

  public isNoteEx(path: string): boolean {
    const settings = this.getSettings();
    return settings.isNote?.(path) ?? false;
  }
}

/**
 * Registers the rename/delete handlers.
 *
 * @param plugin - The plugin instance.
 * @param settingsBuilder - A function that returns the settings for the rename delete handler.
 */
export function registerRenameDeleteHandlers(plugin: AbortablePlugin, settingsBuilder: () => Partial<RenameDeleteHandlerSettings>): void {
  new Registry(plugin, settingsBuilder, new SettingsManager(plugin.app)).register();
}

async function cleanupParentFolders(app: App, settings: Partial<RenameDeleteHandlerSettings>, parentFolderPaths: string[]): Promise<void> {
  if (settings.emptyFolderBehavior === EmptyFolderBehavior.Keep) {
    return;
  }
  for (const parentFolderPath of parentFolderPaths) {
    switch (settings.emptyFolderBehavior) {
      case EmptyFolderBehavior.Delete:
        await deleteEmptyFolder(app, parentFolderPath);
        break;
      case EmptyFolderBehavior.DeleteWithEmptyParents:
        await deleteEmptyFolderHierarchy(app, parentFolderPath);
        break;
      default:
        break;
    }
  }
}
