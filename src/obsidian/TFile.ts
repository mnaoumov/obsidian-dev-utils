import {
  App,
  TFile
} from "obsidian";

export type PathOrFile = string | TFile;

export function getFile(app: App, pathOrFile: PathOrFile): TFile {
  const file = getFileOrNull(app, pathOrFile);
  if (!file) {
    throw new Error(`File not found: ${pathOrFile as string}`);
  }

  return file;
}

export function getFileOrNull(app: App, pathOrFile: PathOrFile): TFile | null {
  return pathOrFile instanceof TFile ? pathOrFile : app.vault.getFileByPath(pathOrFile);
}
