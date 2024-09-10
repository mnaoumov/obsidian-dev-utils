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
  dirname,
  join,
  relative
} from '../Path.ts';
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
}

/**
 * Registers the rename/delete handlers.
 * @param plugin - The plugin instance.
 * @param settingsBuilder - A function that returns the settings for the rename delete handler.
 * @returns void
 */
export function registerRenameDeleteHandlers(plugin: Plugin, settingsBuilder: () => RenameDeleteHandlerSettings): void {
  const app = plugin.app;
  const renameDeleteHandler = new RenameDeleteHandler(app, settingsBuilder);
  plugin.registerEvent(
    app.vault.on('delete', (file) => {
      invokeAsyncSafely(renameDeleteHandler.handleDelete(file));
    })
  );

  plugin.registerEvent(
    app.vault.on('rename', (file, oldPath) => {
      invokeAsyncSafely(renameDeleteHandler.handleRename(file, oldPath));
    })
  );
}

class RenameDeleteHandler {
  public constructor(private app: App, private settingsBuilder: () => RenameDeleteHandlerSettings) { }

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
      for (const oldPath of renameMap.keys()) {
        this.renamingPaths.add(oldPath);
      }

      for (const [oldPath2, newPath2] of renameMap.entries()) {
        await this.processRename(oldPath2, newPath2, renameMap);
      }

      await this.processRename(oldPath, file.path, renameMap);
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

    if (this.settingsBuilder().shouldDeleteOrphanAttachments) {
      await deleteSafe(this.app, attachmentFolder, file.path, false, this.settingsBuilder().shouldDeleteEmptyFolders);
    }
  }

  private async fillRenameMap(file: TFile, oldPath: string, renameMap: Map<string, string>): Promise<void> {
    renameMap.set(oldPath, file.path);

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

    for (const child of children) {
      if (isNote(child)) {
        continue;
      }
      const relativePath = relative(oldAttachmentFolderPath, child.path);
      const newDir = join(newAttachmentFolderPath, dirname(relativePath));
      let newChildPath = join(newDir, child.name);
      if (child.path !== newChildPath) {
        newChildPath = this.app.vault.getAvailablePath(join(newDir, child.basename), child.extension);
        renameMap.set(child.path, newChildPath);
      }
    }
  }

  private async processRename(oldPath: string, newPath: string, renameMap: Map<string, string>): Promise<void> {
    let oldFile: TFile | null = null;

    try {
      oldFile = this.app.vault.getFileByPath(oldPath);
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
        if (this.settingsBuilder().shouldDeleteEmptyFolders) {
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
          if (!oldFile) {
            return [];
          }
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
}
