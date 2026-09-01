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
  Reference,
  TAbstractFile,
  TFile,
  TFolder
} from 'obsidian';

/* v8 ignore start -- Deeply coupled to Obsidian runtime; requires running vault for meaningful testing. */
import {
  getDataAdapterEx,
  InternalPluginName
} from '@obsidian-typings/obsidian-public-latest/implementations';
import { t } from 'i18next';
import {
  FileManager,
  Vault
} from 'obsidian';

import type { LinkUpdateProgressReporter } from '../link-update-progress.ts';
import type {
  UpdateLinkParams,
  UpdateLinksInFileParams
} from '../link.ts';
import type { ResourceLockComponent } from '../resource-lock.ts';
import type { RescueStillUsedFileParams } from '../vault-delete.ts';
import type { AbortSignalComponent } from './abort-signal-component.ts';
import type { PluginNoticeComponent } from './plugin-notice-component.ts';

import { filterInPlace } from '../../array.ts';
import { getLibDebugger } from '../../debug.ts';
import { printError } from '../../error.ts';
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
import { getCanvasReferences } from '../canvas.ts';
import { waitForPendingLinkUpdates } from '../file-manager.ts';
import {
  CANVAS_FILE_EXTENSION,
  getFile,
  getFileOrNull,
  getFolderOrNull,
  isCanvasFile,
  isFile,
  isFolder,
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
  getBacklinksForFileOrPath,
  getBacklinksForFileSafe,
  getLinks,
  registerFileCacheForNonExistingFile,
  registerFiles
} from '../metadata-cache.ts';
import { addToQueue } from '../queue.ts';
import { isResourceLockedForPathByAncestor } from '../resource-lock.ts';
import { deleteIfNotUsed } from '../vault-delete.ts';
import {
  cleanupEmptyFolders,
  EmptyFolderBehavior,
  getSafeRenamePath,
  isChildOrSelf,
  renameSafe,
  trashSafe
} from '../vault.ts';
import { ComponentEx } from './component-ex.ts';
import {
  hasPatchToken,
  MonkeyAroundComponent
} from './monkey-around-component.ts';

/**
 * Parameters for {@link RenameDeleteHandlerSettings.getRescuePath}.
 */
export interface GetRescuePathParams {
  /**
   * The path of the attachment that is about to be stranded.
   */
  readonly attachmentPath: string;

  /**
   * The paths of the notes that still reference the attachment once the deletion is done. Never empty.
   */
  readonly survivingNotePaths: readonly string[];
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
   * Where to move an attachment that a deletion would otherwise strand — one that survives because another
   * note still references it, but is left sitting in a folder whose owning note is gone.
   *
   * Deciding the destination is the plugin's attachment-path policy, which is why the handler asks rather
   * than guesses. Returning `null` — or not implementing this at all — keeps the attachment where it is,
   * which is the behavior every consumer had before this member existed.
   */
  getRescuePath?(params: GetRescuePathParams): Promise<null | string>;

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
  readonly linkUpdateProgressReporter: LinkUpdateProgressReporter | null;
  readonly newPath: string;
  readonly oldCache: CachedMetadata | null;
  readonly oldPath: string;
  readonly oldPathBacklinksMap: Map<string, Reference[]>;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly resourceLockComponent: null | ResourceLockComponent;
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

interface DeleteHandlerConstructorParams {
  readonly abortSignal: AbortSignal;
  readonly app: App;
  readonly deletedMetadataCacheMap: Map<string, CachedMetadata>;
  readonly file: TAbstractFile;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly settingsManager: SettingsManager;
}

interface DeleteProtectionPatchComponentConstructorParams {
  readonly app: App;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly settingsManager: SettingsManager;
  shouldInvokeHandler(this: void): boolean;
}

interface DidRescueStillUsedAttachmentParams {
  readonly app: App;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly rescueParams: RescueStillUsedFileParams;
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
  readonly previousCache: CachedMetadata | null;
  readonly settingsManager: SettingsManager;
}

interface RenameDeleteHandlerComponentConstructorParams {
  readonly abortSignalComponent: AbortSignalComponent;
  readonly app: App;
  readonly linkUpdateProgressReporter?: LinkUpdateProgressReporter;
  readonly pluginId: string;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly resourceLockComponent: null | ResourceLockComponent;
  settingsBuilder(this: void): Partial<RenameDeleteHandlerSettings>;
}

class DeleteHandler {
  private readonly abortSignal: AbortSignal;
  private readonly app: App;
  private readonly deletedMetadataCacheMap: Map<string, CachedMetadata>;
  private readonly file: TAbstractFile;
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly settingsManager: SettingsManager;

  public constructor(params: DeleteHandlerConstructorParams) {
    this.app = params.app;
    this.file = params.file;
    this.abortSignal = params.abortSignal;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
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
        const links = getLinks({ cache });

        for (const link of links) {
          const attachmentFile = extractLinkFile({ app: this.app, link, sourcePathOrFile: this.file.path });
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
            rescueStillUsedFile: this.rescueStillUsedFile.bind(this),
            shouldDeleteEmptyFolders: settings.emptyFolderBehavior !== EmptyFolderBehavior.Keep
          });
          this.abortSignal.throwIfAborted();
        }
      }
    }

    parentFolderPaths.delete('');
    await cleanupEmptyFolders({
      app: this.app,
      emptyFolderBehavior: settings.emptyFolderBehavior ?? EmptyFolderBehavior.Keep,
      folderPaths: [...parentFolderPaths]
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
      rescueStillUsedFile: this.rescueStillUsedFile.bind(this),
      shouldDeleteEmptyFolders: settings.emptyFolderBehavior !== EmptyFolderBehavior.Keep
    });
    this.abortSignal.throwIfAborted();
  }

  private rescueStillUsedFile(rescueParams: RescueStillUsedFileParams): Promise<boolean> {
    return didRescueStillUsedAttachment({
      app: this.app,
      pluginNoticeComponent: this.pluginNoticeComponent,
      rescueParams,
      settingsManager: this.settingsManager
    });
  }
}

/**
 * Keeps a folder deletion from destroying an attachment a note outside that folder still references.
 *
 * Deleting a NOTE is already safe: {@link deleteIfNotUsed} discounts the deleted note's own backlinks, sees
 * another note still referencing the attachment, and keeps it. Deleting a FOLDER was not, because
 * {@link RenameDeleteHandlerComponent} only listens (`vault.on('delete')`) and by the time a folder deletion
 * is reported its children are already gone. Nothing reactive can help, so this component intercepts the
 * deletion primitives instead: `FileManager.trashFile` (what the file-explorer Delete flow reaches through
 * `promptForDeletion`) plus the raw `Vault.delete` / `Vault.trash` a plugin may call directly.
 *
 * A folder deletion is scanned first. When nothing inside it is still referenced from outside — the
 * overwhelming majority of deletions — the original runs untouched, so the native behavior is preserved
 * exactly. Only when something would be lost does this take over, replaying the deletion through
 * {@link deleteIfNotUsed}: everything else in the folder goes, the still-referenced attachments and the
 * folders holding them stay, and the `attachmentIsStillUsed` notice fires, mirroring the note case.
 *
 * Files are never intercepted — deleting a file is the user naming that file explicitly.
 */
class DeleteProtectionPatchComponent extends MonkeyAroundComponent {
  private readonly app: App;
  private readonly pluginNoticeComponent: PluginNoticeComponent;

  /**
   * Roots of the folder deletions currently being replayed. The replay deletes through the UNPATCHED
   * original, so it cannot re-enter this component directly — but `FileManager.trashFile` itself calls down
   * into `Vault.trash` / `Vault.delete`, which are patched too, and re-scanning a subtree already being
   * walked is pure waste. Scoped by path rather than by a flag so that an unrelated folder deletion
   * interleaving on an `await` is still protected.
   */
  private readonly replayedFolderPaths = new Set<string>();

  private readonly settingsManager: SettingsManager;
  private readonly shouldInvokeHandler: () => boolean;

  public constructor(params: DeleteProtectionPatchComponentConstructorParams) {
    super();
    this.app = params.app;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.settingsManager = params.settingsManager;
    this.shouldInvokeHandler = params.shouldInvokeHandler;
  }

  public override onload(): void {
    this.registerMethodPatch<FileManager, 'trashFile'>({
      $object: FileManager.prototype,
      methodName: 'trashFile',
      patchHandler: ({ fallback, originalArguments: [file], originalMethodBound }) =>
        this.handleDeletion(file, fallback, async (abstractFile) => {
          await originalMethodBound(abstractFile);
        })
    });
    this.registerMethodPatch<Vault, 'delete'>({
      $object: Vault.prototype,
      methodName: 'delete',
      patchHandler: ({ fallback, originalArguments: [file, force], originalMethodBound }) =>
        this.handleDeletion(file, fallback, async (abstractFile) => {
          await originalMethodBound(abstractFile, force);
        })
    });
    this.registerMethodPatch<Vault, 'trash'>({
      $object: Vault.prototype,
      methodName: 'trash',
      patchHandler: ({ fallback, originalArguments: [file, system], originalMethodBound }) =>
        this.handleDeletion(file, fallback, async (abstractFile) => {
          await originalMethodBound(abstractFile, system);
        })
    });
  }

  /**
   * Collects the paths of every note inside the folder. They are the link sources that disappear along with
   * the folder, so their backlinks must not keep an attachment alive.
   *
   * @param folder - The folder being deleted.
   * @param settings - The aggregated rename/delete handler settings.
   * @returns The paths of the notes inside the folder.
   */
  private collectDeletedNotePaths(folder: TFolder, settings: Partial<RenameDeleteHandlerSettings>): Set<string> {
    const deletedNotePaths = new Set<string>();
    Vault.recurseChildren(folder, (child) => {
      if (isFile(child) && (settings.isNote?.(child.path) ?? false)) {
        deletedNotePaths.add(child.path);
      }
    });
    return deletedNotePaths;
  }

  /**
   * Finds the attachments inside the folder that a note outside it still references, and would therefore be
   * destroyed by deleting the folder.
   *
   * @param folder - The folder being deleted.
   * @param deletedNotePaths - The paths of the notes that disappear along with the folder.
   * @param settings - The aggregated rename/delete handler settings.
   * @returns The paths of the attachments that must survive the deletion.
   */
  private async findStillUsedAttachmentPaths(
    folder: TFolder,
    deletedNotePaths: Set<string>,
    settings: Partial<RenameDeleteHandlerSettings>
  ): Promise<string[]> {
    const candidateFiles: TFile[] = [];
    Vault.recurseChildren(folder, (child) => {
      if (isFile(child) && !(settings.isNote?.(child.path) ?? false)) {
        candidateFiles.push(child);
      }
    });

    const stillUsedAttachmentPaths: string[] = [];

    for (const candidateFile of candidateFiles) {
      const backlinks = await getBacklinksForFileSafe({ app: this.app, pathOrFile: candidateFile });
      for (const deletedNotePath of deletedNotePaths) {
        backlinks.clear(deletedNotePath);
      }
      if (backlinks.count() !== 0) {
        stillUsedAttachmentPaths.push(candidateFile.path);
      }
    }

    return stillUsedAttachmentPaths;
  }

  /**
   * Decides whether a deletion needs protecting and, if so, replaces it with a protected replay.
   *
   * @param file - The abstract file being deleted.
   * @param fallback - Invokes the intercepted method unchanged.
   * @param deleteAbstractFile - Deletes a single abstract file through the intercepted method's unpatched original.
   * @returns A {@link Promise} that resolves when the deletion is done.
   */
  private handleDeletion(
    file: TAbstractFile,
    fallback: () => Promise<void>,
    deleteAbstractFile: (abstractFile: TAbstractFile) => Promise<void>
  ): Promise<void> {
    if (!this.shouldConsiderFolder(file)) {
      return fallback();
    }

    return this.replayFolderDeletion(file, fallback, deleteAbstractFile);
  }

  /**
   * Deletes the folder while keeping whatever inside it is still referenced from outside.
   *
   * @param folder - The folder being deleted.
   * @param fallback - Invokes the intercepted method unchanged.
   * @param deleteAbstractFile - Deletes a single abstract file through the intercepted method's unpatched original.
   * @returns A {@link Promise} that resolves when the deletion is done.
   */
  private async replayFolderDeletion(
    folder: TFolder,
    fallback: () => Promise<void>,
    deleteAbstractFile: (abstractFile: TAbstractFile) => Promise<void>
  ): Promise<void> {
    const settings = this.settingsManager.getSettings();
    const deletedNotePaths = this.collectDeletedNotePaths(folder, settings);
    const stillUsedAttachmentPaths = await this.findStillUsedAttachmentPaths(folder, deletedNotePaths, settings);

    if (stillUsedAttachmentPaths.length === 0) {
      getLibDebugger('RenameDeleteHandler:deleteProtection')(`Nothing to protect in ${folder.path}; deleting it as usual.`);
      await fallback();
      return;
    }

    getLibDebugger('RenameDeleteHandler:deleteProtection')(
      `Protecting ${stillUsedAttachmentPaths.length.toString()} still-referenced attachment(s) from the deletion of ${folder.path}: ${toJson(stillUsedAttachmentPaths)}`
    );

    this.replayedFolderPaths.add(folder.path);
    try {
      await deleteIfNotUsed({
        app: this.app,
        deleteAbstractFile,
        deletedNotePaths: [...deletedNotePaths],
        pathOrFile: folder,
        pluginNoticeComponent: this.pluginNoticeComponent,
        rescueStillUsedFile: this.rescueStillUsedFile.bind(this),
        /*
         * The user named THIS folder, so it goes even under `EmptyFolderBehavior.Keep` — that setting
         * governs folders emptied incidentally, not the one explicitly deleted. `deleteIfNotUsed` still
         * refuses to remove any folder whose child had to be kept, which is the protection wanted here.
         */
        shouldDeleteEmptyFolders: true,
        /*
         * A note that others link to is deleted as normal; Obsidian leaves the dangling link. Protecting
         * notes too would make deleting a folder of linked-to notes impossible.
         */
        shouldProtectIfStillUsed: (candidateFile) => !(settings.isNote?.(candidateFile.path) ?? false)
      });
    } finally {
      this.replayedFolderPaths.delete(folder.path);
    }
  }

  private rescueStillUsedFile(rescueParams: RescueStillUsedFileParams): Promise<boolean> {
    return didRescueStillUsedAttachment({
      app: this.app,
      pluginNoticeComponent: this.pluginNoticeComponent,
      rescueParams,
      settingsManager: this.settingsManager
    });
  }

  /**
   * Checks whether a deletion is a folder deletion this handler is responsible for protecting.
   *
   * Every check here is synchronous and cheap, so a file deletion — the overwhelming majority — costs one
   * {@link isFolder} call and reaches the original untouched.
   *
   * @param file - The abstract file being deleted.
   * @returns `true` when the deletion should be scanned before it runs.
   */
  private shouldConsiderFolder(file: TAbstractFile): file is TFolder {
    if (!isFolder(file)) {
      return false;
    }

    if (!this.shouldInvokeHandler()) {
      return false;
    }

    const settings = this.settingsManager.getSettings();
    if (!settings.shouldHandleDeletions) {
      return false;
    }

    if (settings.isPathIgnored?.(file.path) ?? false) {
      return false;
    }

    for (const replayedFolderPath of this.replayedFolderPaths) {
      if (isChildOrSelf({ app: this.app, childPathOrFile: file.path, parentPathOrFile: replayedFolderPath })) {
        return false;
      }
    }

    return true;
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
      $object: this.fileManager,
      methodName: 'runAsyncLinkUpdate',
      patchHandler: ({
        fallback,
        originalArguments: [linkUpdatesHandler],
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
    let isForeignLockedRenameCalled = false;
    const eventRef = this.app.vault.on('rename', (file, oldPath) => {
      isRenameCalled = true;
      /*
       * A rename performed inside a foreign plugin's in-flight locked transaction (which locks the
       * affected folder subtree, e.g. Advanced Note Composer's folder merge) is owned by that
       * transaction, which is responsible for its own link consistency. This handler deliberately does
       * NOT rewrite links for it, so suppressing Obsidian's native link update below would leave the
       * links dangling. Let the native update proceed untouched. See
       * https://github.com/mnaoumov/obsidian-advanced-note-composer/issues/146.
       */
      if (isResourceLockedForPathByAncestor(this.app, file.path) || isResourceLockedForPathByAncestor(this.app, oldPath)) {
        isForeignLockedRenameCalled = true;
      }
    });
    try {
      await linkUpdatesHandler(linkUpdates);
    } finally {
      this.app.vault.offref(eventRef);
    }
    const settings = this.settingsManager.getSettings();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- It might changed in `rename` event handler. ESLint mistakenly does not recognize it.
    if (!isRenameCalled || !settings.shouldHandleRenames || isForeignLockedRenameCalled) {
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
  private readonly previousCache: CachedMetadata | null;
  private readonly settingsManager: SettingsManager;

  public constructor(params: MetadataDeletedHandlerConstructorParams) {
    this.deletedMetadataCacheMap = params.deletedMetadataCacheMap;
    this.file = params.file;
    this.previousCache = params.previousCache;
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

    if (isMarkdownFile(this.file) && this.previousCache) {
      this.deletedMetadataCacheMap.set(this.file.path, this.previousCache);
    }
  }
}

class RenameHandler {
  private readonly abortSignal: AbortSignal;
  private readonly app: App;
  private readonly handledRenames: HandledRenames;
  private readonly interruptedCombinedBacklinksMap: Map<string, Map<string, string>>;
  private readonly interruptedRenamesMap: Map<string, InterruptedRename[]>;
  private readonly linkUpdateProgressReporter: LinkUpdateProgressReporter | null;
  private readonly newPath: string;
  private readonly oldCache: CachedMetadata | null;
  private readonly oldPath: string;
  private readonly oldPathBacklinksMap: Map<string, Reference[]>;
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly resourceLockComponent: null | ResourceLockComponent;
  private readonly settingsManager: SettingsManager;

  public constructor(params: RenameHandlerConstructorParams) {
    this.abortSignal = params.abortSignal;
    this.app = params.app;
    this.resourceLockComponent = params.resourceLockComponent;
    this.handledRenames = params.handledRenames;
    this.interruptedCombinedBacklinksMap = params.interruptedCombinedBacklinksMap ?? new Map<string, Map<string, string>>();
    this.interruptedRenamesMap = params.interruptedRenamesMap;
    this.linkUpdateProgressReporter = params.linkUpdateProgressReporter;
    this.newPath = params.newPath;
    this.oldCache = params.oldCache;
    this.oldPath = params.oldPath;
    this.oldPathBacklinksMap = params.oldPathBacklinksMap;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.settingsManager = params.settingsManager;
  }

  public async handle(): Promise<void> {
    if (this.oldPath === this.newPath) {
      return;
    }
    this.abortSignal.throwIfAborted();

    /*
     * The rename that triggered this handler is very likely still inside Obsidian's own
     * `FileManager.runAsyncLinkUpdate` cycle, which is about to decide — synchronously — which links to
     * rewrite, by re-resolving each one. Everything below temporarily registers a phantom file at the
     * old path (`registerFiles`, directly here and inside `RenameMap`) and holds it across an `await`;
     * seen mid-decision, that phantom makes the old path still resolve, so Obsidian concludes nothing
     * changed and rewrites nothing. Standing invariant: never touch the vault index while Obsidian is
     * mid-decision. See https://github.com/mnaoumov/obsidian-custom-attachment-location/issues/47.
     */
    await waitForPendingLinkUpdates(this.app);
    this.abortSignal.throwIfAborted();

    await this.continueInterruptedRenames();
    this.abortSignal.throwIfAborted();

    // The refreshed backlinks feed `oldPathBacklinksMap`, which only the link-rewrite steps below read, and those are gated on the same flag.
    if (this.settingsManager.getSettings().shouldHandleRenames) {
      await this.refreshLinks();
      this.abortSignal.throwIfAborted();
    }

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

      const settings = this.settingsManager.getSettings();

      const combinedBacklinksMap = new Map<string, Map<string, string>>();

      // Backlinks are only consumed by the link-rewrite steps below, which are gated on
      // `shouldHandleRenames`. Skip gathering them (a backlink fetch per attachment) on a move-only rename.
      if (settings.shouldHandleRenames) {
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
          const attachmentOldPathBacklinks = await getBacklinksForFileSafe({ app: this.app, pathOrFile: attachmentOldPath });
          const attachmentOldPathBacklinksMap = attachmentOldPathBacklinks.data;
          this.abortSignal.throwIfAborted();
          renameMap.initBacklinksMap({
            combinedBacklinksMap,
            path: attachmentOldPath,
            singleBacklinksMap: attachmentOldPathBacklinksMap
          });
        }
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

      await cleanupEmptyFolders({
        app: this.app,
        emptyFolderBehavior: settings.emptyFolderBehavior ?? EmptyFolderBehavior.Keep,
        folderPaths: [...parentFolderPaths]
      });
      this.abortSignal.throwIfAborted();

      /*
       * The attachment move above runs regardless of `shouldHandleRenames` (that is the point of decoupling
       * "Move attachments with note" from "Update links"). The remaining steps only rewrite links, so skip
       * them when link updates are disabled; the `finally` block below still runs.
       */
      if (!settings.shouldHandleRenames) {
        return;
      }

      const backlinkEntries = [...combinedBacklinksMap, ...this.interruptedCombinedBacklinksMap];
      let processedBacklinkFiles = 0;
      for (const [newBacklinkPath, linkKeyToPathMap] of backlinkEntries) {
        let linkIndex = 0;
        await editLinks({
          app: this.app,
          linkConverter: (link) => {
            linkIndex++;
            const oldAttachmentPath = linkKeyToPathMap.get(getLinkIdentityKey(link));
            if (!oldAttachmentPath) {
              /*
               * A link that is not in the snapshot was either never ours to rewrite, or was already
               * rewritten by someone else (leaving it correct). Either way there is nothing to do -
               * but log it, because a silent skip here is exactly how
               * https://github.com/mnaoumov/obsidian-custom-attachment-location/issues/60 stayed
               * invisible: every skipped link left a broken embed and reported nothing.
               */
              getLibDebugger('RenameDeleteHandler:updateBacklinks')(
                `No snapshot entry for link ${toJson(link)} in ${newBacklinkPath}; leaving it unchanged.`
              );
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
          },
          pathOrFile: newBacklinkPath,
          pluginNoticeComponent,
          resourceLockComponent: this.resourceLockComponent,
          shouldFailOnMissingFile: false
        });
        this.abortSignal.throwIfAborted();
        processedBacklinkFiles++;
        this.linkUpdateProgressReporter?.({
          currentPath: newBacklinkPath,
          processed: processedBacklinkFiles,
          total: backlinkEntries.length
        });
      }

      if (isNote(this.newPath)) {
        await updateLinksInFile(normalizeOptionalProperties<UpdateLinksInFileParams>({
          app: this.app,
          newSourcePathOrFile: this.newPath,
          oldSourcePathOrFile: this.oldPath,
          pluginNoticeComponent,
          resourceLockComponent: this.resourceLockComponent,
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
      const orphanKeys = [...this.handledRenames.keys()];
      addToQueue({
        abortSignal: this.abortSignal,
        operationFunction: () => {
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
          linkUpdateProgressReporter: this.linkUpdateProgressReporter,
          newPath: this.newPath,
          oldCache: this.oldCache,
          oldPath: interruptedRename.oldPath,
          oldPathBacklinksMap: this.oldPathBacklinksMap,
          pluginNoticeComponent: this.pluginNoticeComponent,
          resourceLockComponent: this.resourceLockComponent,
          settingsManager: this.settingsManager
        }).handle();
      }
    }
  }

  private async handleCaseCollision(): Promise<boolean> {
    if (!getDataAdapterEx(this.app).insensitive || this.oldPath.toLowerCase() !== this.newPath.toLowerCase()) {
      return false;
    }

    const temporaryPath = join(dirname(this.newPath), `__temp__${basename(this.newPath)}`);
    await this.renameHandled(this.newPath, temporaryPath);

    await new RenameHandler({
      abortSignal: this.abortSignal,
      app: this.app,
      handledRenames: this.handledRenames,
      interruptedRenamesMap: this.interruptedRenamesMap,
      linkUpdateProgressReporter: this.linkUpdateProgressReporter,
      newPath: temporaryPath,
      oldCache: this.oldCache,
      oldPath: this.oldPath,
      oldPathBacklinksMap: this.oldPathBacklinksMap,
      pluginNoticeComponent: this.pluginNoticeComponent,
      resourceLockComponent: this.resourceLockComponent,
      settingsManager: this.settingsManager
    }).handle();

    await this.app.fileManager.renameFile(getFile({ app: this.app, pathOrFile: temporaryPath }), this.newPath);
    return true;
  }

  private async refreshLinks(): Promise<void> {
    const fakeOldFile = getFile({ app: this.app, pathOrFile: this.oldPath, shouldIncludeNonExisting: true });
    let oldPathBacklinksMapRefreshed: Map<string, Reference[]>;
    {
      using _registration = registerFiles(this.app, [fakeOldFile]);
      const fakeOldFileBacklinks = await getBacklinksForFileSafe({ app: this.app, pathOrFile: fakeOldFile });
      oldPathBacklinksMapRefreshed = fakeOldFileBacklinks.data;
    }

    for (const [backlinkPath, refreshedLinks] of oldPathBacklinksMapRefreshed) {
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
    this.oldPathLinks = this.oldCache ? getLinks({ cache: this.oldCache }) : [];
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

    // Obsidian does not index a canvas file into the metadata cache.
    // The cache-derived `oldPathLinks` is empty for a canvas, hiding its embedded attachments.
    // Reading the canvas references directly moves them with the canvas (mirroring note behavior).
    // The file already lives at the new path after the rename, so read the references from there.
    if (isCanvasFile(this.oldPath)) {
      const canvasReferences = await getCanvasReferences(this.app, this.newPath);
      this.oldPathLinks.push(...canvasReferences);
    }

    const settings = this.settingsManager.getSettings();

    const oldFile = getFile({ app: this.app, pathOrFile: this.oldPath, shouldIncludeNonExisting: true });
    const oldAttachmentFolderPath = await this.getOldAttachmentFolderPath(oldFile);

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
        const oldAttachmentFile = extractLinkFile({ app: this.app, link: oldPathLink, sourcePathOrFile: this.oldPath });
        if (!oldAttachmentFile) {
          continue;
        }

        if (isOldAttachmentFolderAtRoot || oldAttachmentFile.path.startsWith(oldAttachmentFolderPath)) {
          const oldAttachmentBacklinks = await getBacklinksForFileSafe({ app: this.app, pathOrFile: oldAttachmentFile });
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
        const directory = dirname(newAttachmentFilePath);
        const extension = extname(newAttachmentFilePath);
        const baseName = basename(newAttachmentFilePath, extension);
        newAttachmentFilePath = this.app.vault.getAvailablePath(join(directory, baseName), extension.slice(1));
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
    for (const [backlinkPath, links] of singleBacklinksMap) {
      const newBacklinkPath = this.map.get(backlinkPath) ?? backlinkPath;
      const linkKeyToPathMap = combinedBacklinksMap.get(newBacklinkPath) ?? new Map<string, string>();
      combinedBacklinksMap.set(newBacklinkPath, linkKeyToPathMap);
      for (const link of links) {
        linkKeyToPathMap.set(getLinkIdentityKey(link), path);
      }
    }
  }

  public initOriginalLinksMap(combinedBacklinksMap: Map<string, Map<string, string>>): void {
    for (const oldPathLink of this.oldPathLinks) {
      const oldAttachmentFile = extractLinkFile({ app: this.app, link: oldPathLink, sourcePathOrFile: this.oldPath });
      if (!oldAttachmentFile) {
        continue;
      }
      const backlinksMap = new Map<string, Reference[]>([[this.newPath, [oldPathLink]]]);
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

  private async getOldAttachmentFolderPath(oldFile: TFile): Promise<string> {
    using _registration = registerFiles(this.app, [oldFile]);
    using _cacheRegistration = this.oldCache && oldFile.deleted
      ? registerFileCacheForNonExistingFile({ app: this.app, cache: this.oldCache, pathOrFile: oldFile })
      : undefined;
    return await getAttachmentFolderPath({
      app: this.app,
      context: AttachmentPathContext.RenameNote,
      notePathOrFile: this.oldPath
    });
  }
}

class SettingsManager {
  public readonly renameDeleteHandlersMap: Map<string, () => Partial<RenameDeleteHandlerSettings>>;

  public constructor() {
    this.renameDeleteHandlersMap = getObsidianDevUtilsState('renameDeleteHandlersMap', new Map<string, () => Partial<RenameDeleteHandlerSettings>>()).value;
  }

  public getSettings(): Partial<RenameDeleteHandlerSettings> {
    const settingsBuilders = [...this.renameDeleteHandlersMap.values()].reverse();

    const settings: Partial<RenameDeleteHandlerSettings> = {};
    // eslint-disable-next-line unicorn/no-immediate-mutation -- Folding these into the object literal keeps them optional under `Partial<>`, losing the narrowing that makes them callable below without a nullish check.
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
      if (newSettings.getRescuePath) {
        /*
         * First plugin to answer owns the destination, mirroring `emptyFolderBehavior`. Left `undefined`
         * when nobody implements it, so the rescue never runs for consumers that did not opt in.
         */
        settings.getRescuePath ??= newSettings.getRescuePath;
      }
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
 * Component that handles rename and delete events in Obsidian.
 * It listens to rename and delete events and updates links accordingly.
 * It also handles edge cases such as case-only renames and collisions with existing files.
 */
export class RenameDeleteHandlerComponent extends ComponentEx {
  /**
   * The abort signal component whose signal cancels in-flight rename operations.
   */
  protected readonly abortSignalComponent: AbortSignalComponent;

  /**
   * The Obsidian app instance.
   */
  protected readonly app: App;
  /**
   * An optional reporter invoked once per backlink file whose links are updated during a rename/move,
   * with the running count of processed files and the total. When `null`, no progress is reported.
   */
  protected readonly linkUpdateProgressReporter: LinkUpdateProgressReporter | null;
  /**
   * The plugin ID used to identify this handler among the registered rename/delete handlers.
   */
  protected readonly pluginId: string;
  /**
   * The notice component used to report updated links to the user.
   */
  protected readonly pluginNoticeComponent: PluginNoticeComponent;
  /**
   * The resource lock component used to guard link updates, or `null` if none is used.
   */
  protected readonly resourceLockComponent: null | ResourceLockComponent;

  /**
   * Builds this plugin's rename/delete handler settings.
   */
  protected readonly settingsBuilder: () => Partial<RenameDeleteHandlerSettings>;

  /**
   * The manager that aggregates rename/delete handler settings across registered plugins.
   */
  protected readonly settingsManager: SettingsManager;

  private readonly deletedMetadataCacheMap = new Map<string, CachedMetadata>();

  private readonly handledRenames = new HandledRenames();

  private readonly interruptedRenamesMap = new Map<string, InterruptedRename[]>();

  /**
   * Creates an instance of RenameDeleteHandlerComponent.
   *
   * @param params - The parameters for the RenameDeleteHandlerComponent.
   */
  public constructor(params: RenameDeleteHandlerComponentConstructorParams) {
    super();
    this.abortSignalComponent = params.abortSignalComponent;
    this.app = params.app;
    this.linkUpdateProgressReporter = params.linkUpdateProgressReporter ?? null;
    this.resourceLockComponent = params.resourceLockComponent;
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

    this.addChild(
      new DeleteProtectionPatchComponent({
        app: this.app,
        pluginNoticeComponent: this.pluginNoticeComponent,
        settingsManager: this.settingsManager,
        shouldInvokeHandler: this.shouldInvokeHandler.bind(this)
      })
    );
  }

  private handleDelete(file: TAbstractFile): void {
    if (!this.shouldInvokeHandler()) {
      return;
    }
    addToQueue({
      operationFunction: (abortSignal) =>
        new DeleteHandler({
          abortSignal,
          app: this.app,
          deletedMetadataCacheMap: this.deletedMetadataCacheMap,
          file,
          pluginNoticeComponent: this.pluginNoticeComponent,
          settingsManager: this.settingsManager
        }).handle(),
      operationName: t(($) => $.obsidianDevUtils.renameDeleteHandler.handleDelete, { filePath: file.path })
    });
  }

  private handleMetadataDeleted(file: TAbstractFile, previousCache: CachedMetadata | null): void {
    if (!this.shouldInvokeHandler()) {
      return;
    }
    new MetadataDeletedHandler({
      deletedMetadataCacheMap: this.deletedMetadataCacheMap,
      file,
      previousCache,
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

    /*
     * A rename occurring inside a foreign plugin's in-flight locked transaction (which locks the
     * affected folder subtree, e.g. Advanced Note Composer's folder merge) is orchestrated by that
     * transaction's owner, which takes responsibility for its own link consistency. Reacting to it
     * here would (a) perturb Obsidian's native post-rename link update and leave links dangling, and
     * (b) collide with the foreign transaction — an async abort from this handler aborts an
     * already-committed transaction, throwing "Cannot roll back a committed transaction". This
     * handler's own attachment moves are already excluded above via `handledRenames`, so a lock still
     * held here always belongs to a foreign operation; stay out of its way. See
     * https://github.com/mnaoumov/obsidian-advanced-note-composer/issues/146.
     */
    if (isResourceLockedForPathByAncestor(this.app, oldPath) || isResourceLockedForPathByAncestor(this.app, newPath)) {
      getLibDebugger('RenameDeleteHandler:handleRename')(
        `Skipping rename handler of ${oldPath} -> ${newPath} as it occurs inside a foreign locked transaction.`
      );
      return;
    }

    const settings = this.settingsManager.getSettings();
    if (!settings.shouldHandleRenames && !settings.shouldRenameAttachmentFolder && !settings.shouldRenameAttachmentFiles) {
      return;
    }

    if (this.isNoOpRename(settings, oldPath, newPath)) {
      getLibDebugger('RenameDeleteHandler:handleRename')(
        `Skipping rename handler of ${oldPath} -> ${newPath} as it is not a note and there is nothing to do with link updates disabled.`
      );
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
      operationFunction: (abortSignal) =>
        new RenameHandler({
          abortSignal,
          app: this.app,
          handledRenames: this.handledRenames,
          interruptedRenamesMap: this.interruptedRenamesMap,
          linkUpdateProgressReporter: this.linkUpdateProgressReporter,
          newPath,
          oldCache,
          oldPath,
          oldPathBacklinksMap,
          pluginNoticeComponent: this.pluginNoticeComponent,
          resourceLockComponent: this.resourceLockComponent,
          settingsManager: this.settingsManager
        }).handle(),
      operationName: t(($) => $.obsidianDevUtils.renameDeleteHandler.handleRename, { newPath, oldPath })
    });
  }

  /**
   * With link rewriting off, the handler's only remaining jobs are moving a NOTE's attachments and pruning
   * the folder a moved file vacated. A non-note rename needs neither when empty folders are kept, so there
   * is nothing to queue.
   *
   * @param settings - The aggregated rename/delete handler settings.
   * @param oldPath - The path the file was renamed from.
   * @param newPath - The path the file was renamed to.
   * @returns `true` when the handler would do no work for this rename.
   */
  private isNoOpRename(settings: Partial<RenameDeleteHandlerSettings>, oldPath: string, newPath: string): boolean {
    return !settings.shouldHandleRenames
      && !(settings.isNote?.(oldPath) ?? false)
      && !(settings.isNote?.(newPath) ?? false)
      && (settings.emptyFolderBehavior ?? EmptyFolderBehavior.Keep) === EmptyFolderBehavior.Keep;
  }

  private logRegisteredHandlers(): void {
    const renameDeleteHandlersMap = this.settingsManager.renameDeleteHandlersMap;
    getLibDebugger('RenameDeleteHandler:logRegisteredHandlers')(
      `Plugins with registered rename/delete handlers: ${JSON.stringify([...renameDeleteHandlersMap.keys()])}`
    );
  }

  private shouldInvokeHandler(): boolean {
    const renameDeleteHandlersMap = this.settingsManager.renameDeleteHandlersMap;
    const mainPluginId = [...renameDeleteHandlersMap.keys()][0];
    return mainPluginId === this.pluginId;
  }
}

/**
 * Moves an attachment a deletion would otherwise strand to wherever the consuming plugin says it belongs.
 *
 * Shared by both delete paths — the note delete in {@link DeleteHandler} and the folder delete replayed by
 * {@link DeleteProtectionPatchComponent} — because both reach the same point: {@link deleteIfNotUsed} has
 * decided the attachment must survive, and without this it would survive in a folder nothing owns any more.
 *
 * A consumer that does not implement {@link RenameDeleteHandlerSettings.getRescuePath}, or that answers
 * `null`, gets exactly the behavior it had before this existed: the attachment stays put.
 *
 * @param params - The parameters for the function.
 * @returns A {@link Promise} that resolves to whether the attachment was moved.
 */
async function didRescueStillUsedAttachment(params: DidRescueStillUsedAttachmentParams): Promise<boolean> {
  const settings = params.settingsManager.getSettings();
  if (!settings.getRescuePath) {
    return false;
  }

  const attachmentPath = params.rescueParams.file.path;
  const rescuePath = await settings.getRescuePath({
    attachmentPath,
    survivingNotePaths: params.rescueParams.survivingNotePaths
  });

  if (rescuePath === null) {
    getLibDebugger('RenameDeleteHandler:didRescueStillUsedAttachment')(`No rescue path for ${attachmentPath}; keeping it where it is.`);
    return false;
  }

  try {
    /*
     * `renameSafe` creates the destination folder, resolves a collision via `getSafeRenamePath`, and moves
     * through `app.fileManager.renameFile`, so the surviving notes' links follow the attachment.
     */
    const newAttachmentPath = await renameSafe({
      app: params.app,
      newPath: rescuePath,
      oldPathOrAbstractFile: params.rescueParams.file
    });

    if (newAttachmentPath === attachmentPath) {
      /*
       * The attachment is already where it belongs. This is the normal second look at a file the folder
       * delete just rescued: the owning note's own deletion is reported afterwards and walks its links
       * again. Nothing moved, so nothing is claimed — the caller keeps it in place, which is the truth.
       */
      getLibDebugger('RenameDeleteHandler:didRescueStillUsedAttachment')(`${attachmentPath} already sits at its rescue path; nothing to move.`);
      return false;
    }

    /*
     * The move fires `vault.on('rename')`, so this handler's own `RenameHandler` picks it up like any other
     * attachment move. It is deliberately NOT registered in `handledRenames`:
     * `FileManagerRunAsyncLinkUpdatePatchComponent` already discards Obsidian's native link update while
     * `shouldHandleRenames` is on, so suppressing the handler as well would leave dangling exactly the links
     * this rescue exists to preserve. Let the rewrite settle before the delete walk carries on.
     */
    await waitForPendingLinkUpdates(params.app);

    getLibDebugger('RenameDeleteHandler:didRescueStillUsedAttachment')(`Rescued ${attachmentPath} to ${newAttachmentPath}.`);
    params.pluginNoticeComponent.showNotice(t(($) => $.obsidianDevUtils.notices.attachmentRescued, { attachmentPath, newAttachmentPath }));
    return true;
  } catch (error) {
    /*
     * A rescue that half happened must not read as success — reporting `false` falls back to keeping the
     * attachment in place with the `attachmentIsStillUsed` notice, which is still safe.
     */
    printError(new Error(`Failed to rescue ${attachmentPath} to ${rescuePath}`, { cause: error }));
    return false;
  }
}

/**
 * Builds the key under which a link is remembered while a rename is in flight.
 *
 * The rewrite has to match links captured BEFORE the attachments moved against the links the metadata cache
 * reports AFTER they moved, and the only thing that reliably survives that gap is the link's TEXT.
 * Deliberately excludes `position`: keying on the whole {@link Reference} meant that as soon as anything
 * edited the file in between — a co-installed plugin rewriting its own links, most often — every link below
 * the edit shifted its offsets, missed its key, and was skipped in silence, leaving the note with some embeds
 * rewritten and the rest broken. See
 * https://github.com/mnaoumov/obsidian-custom-attachment-location/issues/60.
 *
 * Two links with identical text in one file necessarily resolve to the same target, so collapsing them onto
 * one key loses nothing.
 *
 * @param link - The link to build the key for.
 * @returns The key identifying the link by its text alone.
 */
function getLinkIdentityKey(link: Reference): string {
  return toJson({
    link: link.link,
    original: link.original
  });
}

/* v8 ignore stop */

export { EmptyFolderBehavior } from '../vault.ts';
