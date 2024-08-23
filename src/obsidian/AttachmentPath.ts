/**
 * @file Provides utility functions for working with attachment paths.
 */

import type {
  App,
  Vault
} from "obsidian";
import {
  basename,
  dirname,
  extname
} from "../Path.ts";
import { createTFileInstance } from "obsidian-typings/implementations";
import { nameof } from "../Object.ts";

/**
 * Retrieves the attachment folder path for a given note.
 *
 * @param app - The Obsidian application instance.
 * @param notePath - The path of the note.
 * @returns A promise that resolves to the attachment folder path.
 */
export async function getAttachmentFolderPath(app: App, notePath: string): Promise<string> {
  return dirname(await getAttachmentFilePath(app, "DUMMY_FILE.pdf", notePath));
}

/**
 * Retrieves the file path for an attachment within a note.
 *
 * @param app - The Obsidian application instance.
 * @param attachmentPath - The path of the attachment.
 * @param notePath - The path of the note.
 * @returns A promise that resolves to the file path of the attachment.
 */
export async function getAttachmentFilePath(app: App, attachmentPath: string, notePath: string): Promise<string> {
  const note = createTFileInstance(app.vault, notePath);
  const ext = extname(attachmentPath);
  const fileName = basename(attachmentPath, ext);

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalMkdir = app.vault.adapter.mkdir;
  app.vault.adapter.mkdir = async (path: string): Promise<void> => {
    if (new Error().stack?.includes(nameof<Vault>("getAvailablePathForAttachments"))) {
      return;
    }
    return originalMkdir.call(app.vault.adapter, path);
  };

  try {
    const path = await app.vault.getAvailablePathForAttachments(fileName, ext.slice(1), note);
    return path;
  } finally {
    app.vault.adapter.mkdir = originalMkdir;
  }
}
