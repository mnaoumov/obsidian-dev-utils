import type {
  Plugin,
  ReferenceCache,
  TAbstractFile
} from 'obsidian';
import {
  App,
  TFile,
  Vault
} from 'obsidian';
import type { CanvasData } from 'obsidian/canvas.js';
import { createTFileInstance } from 'obsidian-typings/implementations';

import { invokeAsyncSafely } from '../Async.ts';
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
import {
  extractLinkFile,
  updateLink,
  updateLinksInFile
} from './Link.ts';
import {
  getAllLinks,
  getBacklinksForFileSafe,
  getCacheSafe
} from './MetadataCache.ts';
import {
  isCanvasFile,
  isMarkdownFile,
  isNote
} from './TAbstractFile.ts';
import {
  applyFileChanges,
  createFolderSafe,
  deleteEmptyFolderHierarchy,
  deleteSafe,
  processWithRetry
} from './Vault.ts';

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
   * Whether to delete empty folders.
   */
  shouldDeleteEmptyFolders: boolean;

  /**
   * Whether to delete orphan attachments after a delete.
   */
  shouldDeleteOrphanAttachments: boolean;

  /**
   * Whether to rename attachment part names to match the note name.
   */
  shouldRenameAttachmentPartNameToMatchNoteName: boolean
}

const DEFAULT_SETTINGS: RenameDeleteHandlerSettings = {
  shouldDeleteEmptyFolders: false,
  shouldDeleteOrphanAttachments: false,
  shouldRenameAttachmentPartNameToMatchNoteName: false
};

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
  const renameDeleteHandler = new RenameDeleteHandler(app);
  plugin.registerEvent(
    app.vault.on('delete', (file) => {
      if (!shouldInvokeHandler(app, pluginId, 'Delete')) {
        return;
      }
      invokeAsyncSafely(renameDeleteHandler.handleDelete(file));
    })
  );

  plugin.registerEvent(
    app.vault.on('rename', (file, oldPath) => {
      if (!shouldInvokeHandler(app, pluginId, 'Rename')) {
        return;
      }
      invokeAsyncSafely(renameDeleteHandler.handleRename(file, oldPath));
    })
  );
}

function shouldInvokeHandler(app: App, pluginId: string, handlerType: string): boolean {
  const renameDeleteHandlerPluginIds = getRenameDeleteHandlersMap(app);
  const mainPluginId = Array.from(renameDeleteHandlerPluginIds.keys())[0];
  if (mainPluginId !== pluginId) {
    console.warn(`${handlerType} handler for plugin ${pluginId} is skipped, because it is handled by plugin ${mainPluginId ?? '(none)'}`);
    return false;
  }
  return true;
}

class RenameDeleteHandler {
  public constructor(private app: App) { }

  private renamingPaths = new Set<string>();
  private specialRenames: SpecialRename[] = [];

  public async handleRename(file: TAbstractFile, oldPath: string): Promise<void> {
    console.debug(`Handle Rename ${oldPath} -> ${file.path}`);

    if (this.renamingPaths.has(oldPath)) {
      return;
    }

    if (!(file instanceof TFile)) {
      return;
    }

    const specialRename = this.specialRenames.find((x) => x.oldPath === file.path);
    if (specialRename) {
      await this.app.vault.rename(file, specialRename.tempPath);
      return;
    }

    if (this.app.vault.adapter.insensitive && oldPath.toLowerCase() === file.path.toLowerCase() && dirname(oldPath) === dirname(file.path)) {
      this.specialRenames.push({
        oldPath,
        newPath: file.path,
        tempPath: join(file.parent?.path ?? '', '__temp__' + file.name)
      });

      await this.app.vault.rename(file, oldPath);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const updateAllLinks = this.app.fileManager.updateAllLinks;
    try {
      this.app.fileManager.updateAllLinks = async (): Promise<void> => {
        // do nothing
      };

      const renameMap = new Map<string, string>();
      await this.fillRenameMap(file, oldPath, renameMap);
      renameMap.set(oldPath, file.path);
      for (const oldPath of renameMap.keys()) {
        this.renamingPaths.add(oldPath);
      }

      for (const [oldPath2, newPath2] of renameMap.entries()) {
        await this.processRename(oldPath2, newPath2, renameMap);
      }
    } finally {
      this.renamingPaths.delete(oldPath);
      this.app.fileManager.updateAllLinks = updateAllLinks;

      const specialRename = this.specialRenames.find((x) => x.tempPath === file.path);
      if (specialRename) {
        await this.app.vault.rename(file, specialRename.newPath);
        this.specialRenames.remove(specialRename);
      }
    }
  }

  public async handleDelete(file: TAbstractFile): Promise<void> {
    console.debug(`Handle Delete ${file.path}`);
    if (!isNote(file)) {
      return;
    }

    if (this.renamingPaths.has(file.path)) {
      return;
    }

    const attachmentFolderPath = await getAttachmentFolderPath(this.app, file.path);
    const attachmentFolder = this.app.vault.getFolderByPath(attachmentFolderPath);

    if (!attachmentFolder) {
      return;
    }

    if (this.getSettings().shouldDeleteOrphanAttachments) {
      await deleteSafe(this.app, attachmentFolder, file.path, false, this.getSettings().shouldDeleteEmptyFolders);
    }
  }

  private async fillRenameMap(file: TFile, oldPath: string, renameMap: Map<string, string>): Promise<void> {
    if (!isNote(file)) {
      return;
    }

    const oldAttachmentFolderPath = await getAttachmentFolderPath(this.app, oldPath);
    const newAttachmentFolderPath = await getAttachmentFolderPath(this.app, file.path);
    const dummyOldAttachmentFolderPath = await getAttachmentFolderPath(this.app, join(dirname(oldPath), 'DUMMY_FILE.md'));

    const oldAttachmentFolder = this.app.vault.getFolderByPath(oldAttachmentFolderPath);

    if (!oldAttachmentFolder) {
      return;
    }

    if (oldAttachmentFolderPath === newAttachmentFolderPath) {
      return;
    }

    const children: TFile[] = [];

    if (oldAttachmentFolderPath === dummyOldAttachmentFolderPath) {
      const cache = await getCacheSafe(this.app, file);
      if (!cache) {
        return;
      }
      for (const link of getAllLinks(cache)) {
        const attachmentFile = extractLinkFile(this.app, link, oldPath);
        if (!attachmentFile) {
          continue;
        }

        if (attachmentFile.path.startsWith(oldAttachmentFolderPath)) {
          const backlinks = await getBacklinksForFileSafe(this.app, attachmentFile);
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

    const shouldRenameAttachmentPartNameToMatchNoteName = this.getSettings().shouldRenameAttachmentPartNameToMatchNoteName;
    const oldNoteBaseName = basename(oldPath, extname(oldPath));

    for (const child of children) {
      if (isNote(child)) {
        continue;
      }
      const relativePath = relative(oldAttachmentFolderPath, child.path);
      const newDir = join(newAttachmentFolderPath, dirname(relativePath));
      const newChildBasename = shouldRenameAttachmentPartNameToMatchNoteName
        ? child.basename.replaceAll(oldNoteBaseName, file.basename)
        : child.basename;
      let newChildPath = join(newDir, makeFileName(newChildBasename, child.extension));
      if (child.path !== newChildPath) {
        newChildPath = this.app.vault.getAvailablePath(join(newDir, newChildBasename), child.extension);
        renameMap.set(child.path, newChildPath);
      }
    }
  }

  private async processRename(oldPath: string, newPath: string, renameMap: Map<string, string>): Promise<void> {
    try {
      let oldFile = this.app.vault.getFileByPath(oldPath);
      let newFile = this.app.vault.getFileByPath(newPath);

      if (oldFile) {
        await createFolderSafe(this.app, dirname(newPath));
        const oldFolder = oldFile.parent;
        try {
          if (newFile) {
            try {
              await this.app.fileManager.trashFile(newFile);
            } catch (e) {
              if (this.app.vault.getAbstractFileByPath(newPath)) {
                throw e;
              }
            }
          }
          await this.app.vault.rename(oldFile, newPath);
        } catch (e) {
          if (!this.app.vault.getAbstractFileByPath(newPath) || this.app.vault.getAbstractFileByPath(oldPath)) {
            throw e;
          }
        }
        if (this.getSettings().shouldDeleteEmptyFolders) {
          await deleteEmptyFolderHierarchy(this.app, oldFolder);
        }
      }

      oldFile = createTFileInstance(this.app.vault, oldPath);
      newFile = this.app.vault.getFileByPath(newPath);

      if (!oldFile.deleted || !newFile) {
        throw new Error(`Could not rename ${oldPath} to ${newPath}`);
      }

      const backlinks = await this.getBacklinks(oldFile, newFile);

      for (const parentNotePath of backlinks.keys()) {
        let parentNote = this.app.vault.getFileByPath(parentNotePath);
        if (!parentNote) {
          const newParentNotePath = renameMap.get(parentNotePath);
          if (newParentNotePath) {
            parentNote = this.app.vault.getFileByPath(newParentNotePath);
          }
        }

        if (!parentNote) {
          console.warn(`Parent note not found: ${parentNotePath}`);
          continue;
        }

        await applyFileChanges(this.app, parentNote, async () => {
          const links
            = (await this.getBacklinks(oldFile, newFile)).get(parentNotePath) ?? [];
          const changes = [];

          for (const link of links) {
            changes.push({
              startIndex: link.position.start.offset,
              endIndex: link.position.end.offset,
              oldContent: link.original,
              newContent: updateLink({
                app: this.app,
                link,
                pathOrFile: newFile,
                oldPathOrFile: oldPath,
                sourcePathOrFile: parentNote,
                renameMap
              })
            });
          }

          return changes;
        });
      }

      if (isCanvasFile(newFile)) {
        await processWithRetry(this.app, newFile, (content) => {
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
          app: this.app,
          pathOrFile: newFile,
          oldPathOrFile: oldPath,
          renameMap
        });
      }
    } finally {
      this.renamingPaths.delete(oldPath);
    }
  }

  private async getBacklinks(oldFile: TFile, newFile: TFile | null): Promise<Map<string, ReferenceCache[]>> {
    const backlinks = new Map<string, ReferenceCache[]>();
    const oldLinks = await getBacklinksForFileSafe(this.app, oldFile);
    for (const path of oldLinks.keys()) {
      backlinks.set(path, oldLinks.get(path) ?? []);
    }

    if (!newFile) {
      return backlinks;
    }

    const newLinks = await getBacklinksForFileSafe(this.app, newFile);

    for (const path of newLinks.keys()) {
      const links = backlinks.get(path) ?? [];
      links.push(...newLinks.get(path) ?? []);
      backlinks.set(path, links);
    }

    return backlinks;
  }

  private getSettings(): RenameDeleteHandlerSettings {
    let settings: Partial<RenameDeleteHandlerSettings> = {};
    const renameDeleteHandlersMap = getRenameDeleteHandlersMap(this.app);
    const settingsBuilders = Array.from(renameDeleteHandlersMap.values()).reverse();
    for (const settingsBuilder of settingsBuilders) {
      settings = { ...settings, ...settingsBuilder() };
    }

    return { ...DEFAULT_SETTINGS, ...settings };
  }
}

function getRenameDeleteHandlersMap(app: App): Map<string, () => Partial<RenameDeleteHandlerSettings>> {
  return getObsidianDevUtilsState(app, 'renameDeleteHandlersMap', new Map<string, () => Partial<RenameDeleteHandlerSettings>>()).value;
}

function logPluginSettingsOrder(app: App): void {
  const renameDeleteHandlersMap = getRenameDeleteHandlersMap(app);
  console.debug(`Rename/delete handlers will use plugin settings in the following order: ${Array.from(renameDeleteHandlersMap.keys()).join(', ')}`);
}
