/**
 * @packageDocumentation AttachmentPath
 * Provides utility functions for working with attachment paths.
 */

import type { App } from "obsidian";
import {
  basename,
  dirname,
  extname
} from "../Path.ts";
import {
  createTFileInstance,
  createTFolderInstance
} from "obsidian-typings/implementations";
import type { PathOrFile } from "./TFile.ts";
import { getPath } from "./TAbstractFile.ts";
import { registerFile } from "./MetadataCache.ts";

/**
 * Retrieves the attachment folder path for a given note.
 *
 * @param app - The Obsidian application instance.
 * @param notePathOrFile - The path of the note.
 * @returns A promise that resolves to the attachment folder path.
 */
export async function getAttachmentFolderPath(app: App, notePathOrFile: PathOrFile): Promise<string> {
  return dirname(await getAttachmentFilePath(app, "DUMMY_FILE.pdf", notePathOrFile));
}

/**
 * Retrieves the file path for an attachment within a note.
 *
 * @param app - The Obsidian application instance.
 * @param attachmentPathOrFile - The path of the attachment.
 * @param notePathOrFile - The path of the note.
 * @returns A promise that resolves to the file path of the attachment.
 */
export async function getAttachmentFilePath(app: App, attachmentPathOrFile: PathOrFile, notePathOrFile: PathOrFile): Promise<string> {
  const attachmentPath = getPath(attachmentPathOrFile);
  const notePath = getPath(notePathOrFile);
  const note = createTFileInstance(app.vault, notePath);
  const ext = extname(attachmentPath);
  const fileName = basename(attachmentPath, ext);

  type Patched = {
    __patched?: true;
  };

  const unregisters: (() => void)[] = [];

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalMkdir = app.vault.adapter.mkdir;
  const alreadyPatched = (originalMkdir as Patched).__patched ?? false;
  if (!alreadyPatched) {
    app.vault.adapter.mkdir = async (path: string): Promise<void> => {
      const fakeFolder = createTFolderInstance(app.vault, path);
      const unregister = registerFile(app, fakeFolder);
      unregisters.push(unregister);
      await Promise.resolve();
    };
    (app.vault.adapter.mkdir as Patched).__patched = true;
  }

  try {
    const path = await app.vault.getAvailablePathForAttachments(fileName, ext.slice(1), note);
    return path;
  } finally {
    if (!alreadyPatched) {
      app.vault.adapter.mkdir = originalMkdir;
      for (const unregister of unregisters) {
        unregister();
      }
    }
  }
}
