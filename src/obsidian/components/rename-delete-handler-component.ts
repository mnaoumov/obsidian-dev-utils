/**
 * @file
 *
 * Contains utility functions for handling rename and delete events in Obsidian.
 */

import type {
  LinkUpdate,
  LinkUpdatesHandler
} from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  CachedMetadata,
  FileManager,
  Reference,
  TAbstractFile,
  TFile
} from 'obsidian';

/* v8 ignore start -- Deeply coupled to Obsidian runtime; requires running vault for meaningful testing. */
import {
  getDataAdapterEx,
  InternalPluginName
} from '@obsidian-typings/obsidian-public-latest/implementations';
import { t } from 'i18next';
import { Vault } from 'obsidian';

import type {
  UpdateLinkParams,
  UpdateLinksInFileParams
} from '../link.ts';
import type { AbortSignalComponent } from './abort-signal-component.ts';
import type { PluginNoticeComponent } from './plugin-notice-component.ts';

import { filterInPlace } from '../../array.ts';
import { getLibDebugger } from '../../debug.ts';
import {
  normalizeOptionalProperties,
  toJson
} from '../../object-utils.ts';
import { getObsidianDevUtilsState } from '../../obsidian-dev-utils-state.ts';
import {
  basename,
  dirname,
  extname,
  join,
  relative
} from '../../path.ts';
import {
  AttachmentPathContext,
  getAttachmentFilePath,
  getAttachmentFolderPath,
  hasOwnAttachmentFolder
} from '../attachment-path.ts';
import {
  CANVAS_FILE_EXTENSION,
  getFile,
  getFileOrNull,
  getFolderOrNull,
  isFile,
  isMarkdownFile,
  isNote
} from '../file-system.ts';
import {
  editLinks,
  extractLinkFile,
  updateLink,
  updateLinksInFile
} from '../link.ts';
import {
  getAllLinks,
  getBacklinksForFileOrPath,
  getBacklinksForFileSafe,
  registerFileCacheForNonExistingFile,
  tempRegisterFilesAndRun,
  tempRegisterFilesAndRunAsync,
  unregisterFileCacheForNonExistingFile
} from '../metadata-cache.ts';
import { addToQueue } from '../queue.ts';
import { deleteIfNotUsed } from '../vault-delete.ts';
import {
  deleteEmptyFolder,
  deleteEmptyFolderHierarchy,
  getSafeRenamePath,
  renameSafe,
  trashSafe
} from '../vault.ts';
import { ComponentEx } from './component-ex.ts';
import {
  hasPatchToken,
  MonkeyAroundComponent
} from './monkey-around-component.ts';

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

interface HandledRenameKey {
  newPath: string;
  oldPath: string;
}

interface InterruptedRename {
  combinedBacklinksMap: Map<string, Map<string, string>>;
  oldPath: string;
}

interface RenameHandlerConstructorParams {
  readonly abortSignal: AbortSignal;
  readonly app: App;
  readonly handledRenames: HandledRenames;
  readonly interruptedCombinedBacklinksMap?: Map<string, Map<string, string>>;
  readonly interruptedRenamesMap: Map<string, InterruptedRename[]>;
  readonly newPath: string;
  readonly oldCache: CachedMetadata | null;
  readonly oldPath: string;
  readonly oldPathBacklinksMap: Map<string, Reference[]>;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly settingsManager: SettingsManager;
}

interface RenameMapConstructorParams {
  readonly abortSignal: AbortSignal;
  readonly app: App;
  readonly newPath: string;
  readonly oldCache: CachedMetadata | null;
  readonly oldPath: string;
  readonly settingsManager: SettingsManager;
}

interface RenameMapInitBacklinksMapParams {
  /**
   * The combined backlinks map, keyed by new backlink path, accumulating link-JSON to source-path mappings.
   */
  readonly combinedBacklinksMap: Map<string, Map<string, string>>;

  /**
   * The path whose backlinks are being recorded.
   */
  readonly path: string;

  /**
   * The backlinks map for a single file, keyed by backlink path.
   */
  readonly singleBacklinksMap: Map<string, Reference[]>;
}

const PATCH_TOKEN = Symbol.for('renameDeleteHandler');

interface CleanupParentFoldersParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The paths of the parent folders to clean up.
   */
  readonly parentFolderPaths: string[];

  /**
   * The rename/delete handler settings that determine the empty-folder behavior.
   */
  readonly settings: Partial<RenameDeleteHandlerSettings>;
}

interface DeleteHandlerConstructorParams {
  readonly abortSignal: AbortSignal;
  readonly app: App;
  readonly deletedMetadataCacheMap: Map<string, CachedMetadata>;
  readonly file: TAbstractFile;
  readonly settingsManager: SettingsManager;
}

interface FileManagerRunAsyncLinkUpdatePatchComponentConstructorParams {
  readonly app: App;
  readonly fileManager: FileManager;
  readonly settingsManager: SettingsManager;
}

interface MetadataDeletedHandlerConstructorParams {
  readonly deletedMetadataCacheMap: Map<string, CachedMetadata>;
  readonly file: TAbstractFile;
  readonly prevCache: CachedMetadata | null;
  readonly settingsManager: SettingsManager;
}

interface RenameDeleteHandlerComponentConstructorParams {
  readonly abortSignalComponent: AbortSignalComponent;
  readonly app: App;
  readonly pluginId: string;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  settingsBuilder(this: void): Partial<RenameDeleteHandlerSettings>;
}

class SettingsManager {
  public readonly renameDeleteHandlersMap: Map<string, () => Partial<RenameDeleteHandlerSettings>>;

  public constructor() {
    this.renameDeleteHandlersMap = getObsidianDevUtilsState('renameDeleteHandlersMap', new Map<string, () => Partial<RenameDeleteHandlerSettings>>()).value;
  }

  public getSettings(): Partial<RenameDeleteHandlerSettings> {
    const settingsBuilders = Array.from(this.renameDeleteHandlersMap.values()).reverse();

    const settings: Partial<RenameDeleteHandlerSettings> = {};
    settings.isNote = (path: string): boolean => isNote(path);
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

class DeleteHandler {
  private readonly abortSignal: AbortSignal;
  private readonly app: App;
  private readonly deletedMetadataCacheMap: Map<string, CachedMetadata>;
  private readonly file: TAbstractFile;
  private readonly settingsManager: SettingsManager;

  public constructor(params: DeleteHandlerConstructorParams) {
    this.app = params.app;
    this.file = params.file;
    this.abortSignal = params.abortSignal;
    this.settingsManager = params.settingsManager;
    this.deletedMetadataCacheMap = params.deletedMetadataCacheMap;
  }

  public async handle(): Promise<void> {
    this.abortSignal.throwIfAborted();
    getLibDebugger('RenameDeleteHandler:handleDelete')(`Handle Delete ${this.file.path}`);
    if (!isNote(this.file)) {
      return;
    }

    if (await this.app.vault.adapter.exists(this.file.path)) {
      getLibDebugger('RenameDeleteHandler:handleDelete')(
        `Skipping delete handler of ${this.file.path} as the file still exists on disk (index-only removal, not a real deletion).`
      );
      return;
    }

    const settings = this.settingsManager.getSettings();

    if (settings.isPathIgnored?.(this.file.path)) {
      getLibDebugger('RenameDeleteHandler:handleDelete')(`Skipping delete handler of ${this.file.path} as the path is ignored.`);
      return;
    }

    const parentFolderPaths = new Set<string>([dirname(this.file.path)]);

    if (settings.shouldHandleDeletions) {
      const cache = this.deletedMetadataCacheMap.get(this.file.path);
      this.deletedMetadataCacheMap.delete(this.file.path);
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
          await deleteIfNotUsed({
            app: this.app,
            deletedNotePath: this.file.path,
            pathOrFile: attachmentFile,
            shouldDeleteEmptyFolders: settings.emptyFolderBehavior !== EmptyFolderBehavior.Keep
          });
          this.abortSignal.throwIfAborted();
        }
      }
    }

    parentFolderPaths.delete('');
    await cleanupParentFolders({
      app: this.app,
      parentFolderPaths: Array.from(parentFolderPaths),
      settings: this.settingsManager.getSettings()
    });
    this.abortSignal.throwIfAborted();

    if (!settings.shouldHandleDeletions) {
      return;
    }

    const attachmentFolderPath = await getAttachmentFolderPath({
      app: this.app,
      context: AttachmentPathContext.DeleteNote,
      notePathOrFile: this.file.path
    });
    const attachmentFolder = getFolderOrNull({ app: this.app, pathOrFolder: attachmentFolderPath });

    if (!attachmentFolder) {
      return;
    }

    if (
      !await hasOwnAttachmentFolder({
        app: this.app,
        context: AttachmentPathContext.DeleteNote,
        path: this.file.path
      })
    ) {
      return;
    }

    this.abortSignal.throwIfAborted();

    await deleteIfNotUsed({
      app: this.app,
      deletedNotePath: this.file.path,
      pathOrFile: attachmentFolder,
      shouldDeleteEmptyFolders: settings.emptyFolderBehavior !== EmptyFolderBehavior.Keep
    });
    this.abortSignal.throwIfAborted();
  }
}

class FileManagerRunAsyncLinkUpdatePatchComponent extends MonkeyAroundComponent {
  private readonly app: App;
  private readonly fileManager: FileManager;
  private readonly settingsManager: SettingsManager;

  public constructor(params: FileManagerRunAsyncLinkUpdatePatchComponentConstructorParams) {
    super();
    this.app = params.app;
    this.fileManager = params.fileManager;
    this.settingsManager = params.settingsManager;
  }

  public override onload(): void {
    this.registerMethodPatch({
      methodName: 'runAsyncLinkUpdate',
      obj: this.fileManager,
      patchHandler: ({
        fallback,
        originalArgs: [linkUpdatesHandler],
        originalMethod,
        originalMethodBound
      }) => {
        if (hasPatchToken(originalMethod, PATCH_TOKEN)) {
          return fallback();
        }

        const newHandler: LinkUpdatesHandler = (linkUpdates) => this.wrapLinkUpdatesHandler(linkUpdates, linkUpdatesHandler);
        return originalMethodBound(newHandler);
      }
    });
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
  private readonly deletedMetadataCacheMap: Map<string, CachedMetadata>;
  private readonly file: TAbstractFile;
  private readonly prevCache: CachedMetadata | null;
  private readonly settingsManager: SettingsManager;

  public constructor(params: MetadataDeletedHandlerConstructorParams) {
    this.deletedMetadataCacheMap = params.deletedMetadataCacheMap;
    this.file = params.file;
    this.prevCache = params.prevCache;
    this.settingsManager = params.settingsManager;
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

    if (isMarkdownFile(this.file) && this.prevCache) {
      this.deletedMetadataCacheMap.set(this.file.path, this.prevCache);
    }
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
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly settingsManager: SettingsManager;

  public constructor(params: RenameHandlerConstructorParams) {
    this.abortSignal = params.abortSignal;
    this.app = params.app;
    this.handledRenames = params.handledRenames;
    this.interruptedCombinedBacklinksMap = params.interruptedCombinedBacklinksMap ?? new Map<string, Map<string, string>>();
    this.interruptedRenamesMap = params.interruptedRenamesMap;
    this.newPath = params.newPath;
    this.oldCache = params.oldCache;
    this.oldPath = params.oldPath;
    this.oldPathBacklinksMap = params.oldPathBacklinksMap;
    this.oldPathLinks = this.oldCache ? getAllLinks(this.oldCache) : [];
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.settingsManager = params.settingsManager;
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

    const pluginNoticeComponent = this.pluginNoticeComponent;

    const renamedFilePaths = getObsidianDevUtilsState('renamedFilePaths', new Set<string>()).value;
    const renamedLinks = getObsidianDevUtilsState('renamedLinkPaths', new Set<string>()).value;

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
      renameMap.initBacklinksMap({
        combinedBacklinksMap,
        path: this.oldPath,
        singleBacklinksMap: this.oldPathBacklinksMap
      });

      for (const attachmentOldPath of renameMap.keys()) {
        if (attachmentOldPath === this.oldPath) {
          continue;
        }
        const attachmentOldPathBacklinksMap = (await getBacklinksForFileSafe(this.app, attachmentOldPath)).data;
        this.abortSignal.throwIfAborted();
        renameMap.initBacklinksMap({
          combinedBacklinksMap,
          path: attachmentOldPath,
          singleBacklinksMap: attachmentOldPathBacklinksMap
        });
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

      await cleanupParentFolders({
        app: this.app,
        parentFolderPaths: Array.from(parentFolderPaths),
        settings: this.settingsManager.getSettings()
      });
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

          return updateLink(normalizeOptionalProperties<UpdateLinkParams>({
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

      if (isNote(this.newPath)) {
        await updateLinksInFile(normalizeOptionalProperties<UpdateLinksInFileParams>({
          app: this.app,
          newSourcePathOrFile: this.newPath,
          oldSourcePathOrFile: this.oldPath,
          shouldFailOnMissingFile: false,
          shouldUpdateFileNameAlias: settings.shouldUpdateFileNameAliases
        }));
        this.abortSignal.throwIfAborted();
      }

      if (!getFileOrNull({ app: this.app, pathOrFile: this.newPath })) {
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
        operationFn: () => {
          for (const orphanKey of orphanKeys) {
            this.handledRenames.delete(orphanKey.oldPath, orphanKey.newPath);
          }

          if (renamedLinks.size === 0) {
            return;
          }
          pluginNoticeComponent.showNotice(t(($) => $.obsidianDevUtils.renameDeleteHandler.updatedLinks, { filesCount: renamedFilePaths.size, linksCount: renamedLinks.size }));
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
          pluginNoticeComponent: this.pluginNoticeComponent,
          settingsManager: this.settingsManager
        }).handle();
      }
    }
  }

  private async handleCaseCollision(): Promise<boolean> {
    if (!getDataAdapterEx(this.app).insensitive || this.oldPath.toLowerCase() !== this.newPath.toLowerCase()) {
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
      pluginNoticeComponent: this.pluginNoticeComponent,
      settingsManager: this.settingsManager
    }).handle();

    await this.app.fileManager.renameFile(getFile({ app: this.app, pathOrFile: tempPath }), this.newPath);
    return true;
  }

  private async refreshLinks(): Promise<void> {
    const cache = this.app.metadataCache.getCache(this.oldPath) ?? this.app.metadataCache.getCache(this.newPath);
    const oldPathLinksRefreshed = cache ? getAllLinks(cache) : [];
    const fakeOldFile = getFile({ app: this.app, pathOrFile: this.oldPath, shouldIncludeNonExisting: true });
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
    newPath = getSafeRenamePath({ app: this.app, newPath, oldPathOrAbstractFile: oldPath });
    if (oldPath === newPath) {
      return newPath;
    }
    this.handledRenames.add(oldPath, newPath);
    newPath = await renameSafe({ app: this.app, newPath, oldPathOrAbstractFile: oldPath });
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

  public constructor(params: RenameMapConstructorParams) {
    this.abortSignal = params.abortSignal;
    this.app = params.app;
    this.settingsManager = params.settingsManager;
    this.oldCache = params.oldCache;
    this.oldPath = params.oldPath;
    this.newPath = params.newPath;
    this.oldPathLinks = this.oldCache ? getAllLinks(this.oldCache) : [];
  }

  public entries(): IterableIterator<[string, string]> {
    return this.map.entries();
  }

  public async fill(): Promise<void> {
    this.abortSignal.throwIfAborted();
    this.map.set(this.oldPath, this.newPath);

    if (!isNote(this.oldPath)) {
      return;
    }

    const settings = this.settingsManager.getSettings();

    const oldFile = getFile({ app: this.app, pathOrFile: this.oldPath, shouldIncludeNonExisting: true });
    let oldAttachmentFolderPath = '';
    await tempRegisterFilesAndRunAsync(this.app, [oldFile], async () => {
      const shouldFakeOldPathCache = this.oldCache && oldFile.deleted;
      if (shouldFakeOldPathCache) {
        registerFileCacheForNonExistingFile(this.app, oldFile, this.oldCache);
      }

      try {
        oldAttachmentFolderPath = await getAttachmentFolderPath({
          app: this.app,
          context: AttachmentPathContext.RenameNote,
          notePathOrFile: this.oldPath
        });
      } finally {
        if (shouldFakeOldPathCache) {
          unregisterFileCacheForNonExistingFile(this.app, oldFile);
        }
      }
    });

    const newAttachmentFolderPath = settings.shouldRenameAttachmentFolder
      ? await getAttachmentFolderPath({
        app: this.app,
        context: AttachmentPathContext.RenameNote,
        notePathOrFile: this.newPath
      })
      : oldAttachmentFolderPath;

    const isOldAttachmentFolderAtRoot = oldAttachmentFolderPath === '/';

    const oldAttachmentFolder = getFolderOrNull({ app: this.app, pathOrFolder: oldAttachmentFolderPath });

    if (!oldAttachmentFolder) {
      return;
    }

    if (oldAttachmentFolderPath === newAttachmentFolderPath && !settings.shouldRenameAttachmentFiles) {
      return;
    }

    const oldAttachmentFiles: TFile[] = [];

    if (
      await hasOwnAttachmentFolder({
        app: this.app,
        context: AttachmentPathContext.RenameNote,
        path: this.oldPath
      })
    ) {
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
        const newAttachmentFile = getFileOrNull({ app: this.app, pathOrFile: newAttachmentFilePath });
        if (newAttachmentFile) {
          getLibDebugger('RenameDeleteHandler:fillRenameMap')(`Removing conflicting attachment ${newAttachmentFile.path}.`);
          await trashSafe(this.app, newAttachmentFile);
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

  public initBacklinksMap(params: RenameMapInitBacklinksMapParams): void {
    const {
      combinedBacklinksMap,
      path,
      singleBacklinksMap
    } = params;
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
      this.initBacklinksMap({
        combinedBacklinksMap,
        path: oldAttachmentFile.path,
        singleBacklinksMap: backlinksMap
      });
    }
  }

  public keys(): IterableIterator<string> {
    return this.map.keys();
  }

  public set(oldPath: string, newPath: string): void {
    this.map.set(oldPath, newPath);
  }
}

/**
 * Component that handles rename and delete events in Obsidian.
 * It listens to rename and delete events and updates links accordingly.
 * It also handles edge cases such as case-only renames and collisions with existing files.
 */
export class RenameDeleteHandlerComponent extends ComponentEx {
  private readonly abortSignalComponent: AbortSignalComponent;
  private readonly app: App;
  private readonly deletedMetadataCacheMap = new Map<string, CachedMetadata>();
  private readonly handledRenames = new HandledRenames();
  private readonly interruptedRenamesMap = new Map<string, InterruptedRename[]>();
  private readonly pluginId: string;
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly settingsBuilder: () => Partial<RenameDeleteHandlerSettings>;
  private readonly settingsManager: SettingsManager;

  /**
   * Creates an instance of RenameDeleteHandlerComponent.
   *
   * @param params - The parameters for the RenameDeleteHandlerComponent.
   */
  public constructor(params: RenameDeleteHandlerComponentConstructorParams) {
    super();
    this.abortSignalComponent = params.abortSignalComponent;
    this.app = params.app;
    this.pluginId = params.pluginId;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.settingsBuilder = params.settingsBuilder;
    this.settingsManager = new SettingsManager();
  }

  /**
   * Loads the component
   */
  public override onload(): void {
    const renameDeleteHandlersMap = this.settingsManager.renameDeleteHandlersMap;

    renameDeleteHandlersMap.set(this.pluginId, this.settingsBuilder);
    this.logRegisteredHandlers();

    this.register(() => {
      renameDeleteHandlersMap.delete(this.pluginId);
      this.logRegisteredHandlers();
    });

    this.registerEvent(this.app.vault.on('delete', this.handleDelete.bind(this)));
    this.registerEvent(this.app.vault.on('rename', this.handleRename.bind(this)));
    this.registerEvent(this.app.metadataCache.on('deleted', this.handleMetadataDeleted.bind(this)));

    this.addChild(
      new FileManagerRunAsyncLinkUpdatePatchComponent({
        app: this.app,
        fileManager: this.app.fileManager,
        settingsManager: this.settingsManager
      })
    );
  }

  private handleDelete(file: TAbstractFile): void {
    if (!this.shouldInvokeHandler()) {
      return;
    }
    addToQueue({
      operationFn: (abortSignal) =>
        new DeleteHandler({
          abortSignal,
          app: this.app,
          deletedMetadataCacheMap: this.deletedMetadataCacheMap,
          file,
          settingsManager: this.settingsManager
        }).handle(),
      operationName: t(($) => $.obsidianDevUtils.renameDeleteHandler.handleDelete, { filePath: file.path })
    });
  }

  private handleMetadataDeleted(file: TAbstractFile, prevCache: CachedMetadata | null): void {
    if (!this.shouldInvokeHandler()) {
      return;
    }
    new MetadataDeletedHandler({
      deletedMetadataCacheMap: this.deletedMetadataCacheMap,
      file,
      prevCache,
      settingsManager: this.settingsManager
    }).handle();
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
      abortSignal: this.abortSignalComponent.abortSignal,
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
          pluginNoticeComponent: this.pluginNoticeComponent,
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

  private shouldInvokeHandler(): boolean {
    const renameDeleteHandlersMap = this.settingsManager.renameDeleteHandlersMap;
    const mainPluginId = Array.from(renameDeleteHandlersMap.keys())[0];
    return mainPluginId === this.pluginId;
  }
}

async function cleanupParentFolders(params: CleanupParentFoldersParams): Promise<void> {
  const {
    app,
    parentFolderPaths,
    settings
  } = params;
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

/* v8 ignore stop */
