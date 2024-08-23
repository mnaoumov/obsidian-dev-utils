import {
  App,
  TAbstractFile,
  TFile,
  TFolder,
} from "obsidian";
import { trimEnd } from "../String.ts";

export const MARKDOWN_FILE_EXTENSION = "md";
export const CANVAS_FILE_EXTENSION = "canvas";
export type PathOrAbstractFile = string | TAbstractFile;

export function getAbstractFile(app: App, pathOrFile: PathOrAbstractFile): TAbstractFile {
  const file = getAbstractFileOrNull(app, pathOrFile);
  if (!file) {
    throw new Error(`Abstract file not found: ${pathOrFile as string}`);
  }

  return file;
}

export function getAbstractFileOrNull(app: App, pathOrFile: PathOrAbstractFile): TAbstractFile | null {
  return pathOrFile instanceof TAbstractFile ? pathOrFile : app.vault.getAbstractFileByPath(pathOrFile);
}


export function isNote(file: TAbstractFile | null): file is TFile {
  return isMarkdownFile(file) || isCanvasFile(file);
}

export function isMarkdownFile(file: TAbstractFile | null): file is TFile {
  return file instanceof TFile && file.extension.toLowerCase() === MARKDOWN_FILE_EXTENSION;
}

export function isCanvasFile(file: TAbstractFile | null): file is TFile {
  return file instanceof TFile && file.extension.toLowerCase() === CANVAS_FILE_EXTENSION;
}

export function trimMarkdownExtension(file: TAbstractFile): string {
  if (!isMarkdownFile(file)) {
    return file.path;
  }

  return trimEnd(file.path, "." + MARKDOWN_FILE_EXTENSION);
}

export function isFile(file: TAbstractFile | null): file is TFile {
  return file instanceof TFile;
}

export function isFolder(file: TAbstractFile | null): file is TFolder {
  return file instanceof TFolder;
}
