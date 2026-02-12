import type { TAbstractFile } from './TAbstractFile.ts';

import { TFile } from './TFile.ts';
import { TFolder } from './TFolder.ts';

export class Vault {
  adapter = { insensitive: false };
  fileMap: Record<string, TAbstractFile> = {};

  static recurseChildren(folder: TFolder, cb: (f: TAbstractFile) => void): void {
    for (const child of folder.children) {
      cb(child);
      if (child instanceof TFolder) {
        Vault.recurseChildren(child, cb);
      }
    }
  }

  async cachedRead(_file: TFile): Promise<string> {
    return '';
  }

  async create(path: string, _content: string): Promise<TFile> {
    const f = new TFile();
    f.path = path;
    return f;
  }

  async createFolder(path: string): Promise<TFolder> {
    const f = new TFolder();
    f.path = path;
    return f;
  }

  getAbstractFileByPath(path: string): null | TAbstractFile {
    return this.fileMap[path] ?? null;
  }

  getAvailablePath(base: string, _ext: string): string {
    return base;
  }

  getMarkdownFiles(): TFile[] {
    return Object.values(this.fileMap).filter((f): f is TFile => f instanceof TFile && f.extension === 'md');
  }

  async read(_file: TFile): Promise<string> {
    return '';
  }
}
