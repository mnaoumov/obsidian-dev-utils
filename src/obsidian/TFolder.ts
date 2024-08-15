import {
  type App,
  TFolder
} from "obsidian";

export type PathOrFolder = string | TFolder

export function getFolder(app: App, pathOrFolder: PathOrFolder): TFolder {
  const folder = getFolderOrNull(app, pathOrFolder);
  if (!folder) {
    throw new Error(`Folder not found: ${pathOrFolder as string}`);
  }

  return folder;
}

export function getFolderOrNull(app: App, pathOrFolder: PathOrFolder): TFolder | null {
  return pathOrFolder instanceof TFolder ? pathOrFolder : app.vault.getFolderByPath(pathOrFolder);
}
