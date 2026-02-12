import type { TAbstractFile } from './TAbstractFile.ts';

import { DataAdapter } from './DataAdapter.ts';
import { Events } from './Events.ts';
import { TFile } from './TFile.ts';
import { TFolder } from './TFolder.ts';

export class Vault extends Events {
  adapter: DataAdapter = new DataAdapter();
  // eslint-disable-next-line obsidianmd/hardcoded-config-path
  configDir = '.obsidian';
  fileMap: Record<string, TAbstractFile> = {};

  static recurseChildren(folder: TFolder, cb: (f: TAbstractFile) => unknown): void {
    for (const child of folder.children) {
      cb(child);
      if (child instanceof TFolder) {
        Vault.recurseChildren(child, cb);
      }
    }
  }

  async append(_file: TFile, _data: string): Promise<void> {}

  async cachedRead(_file: TFile): Promise<string> {
    return '';
  }

  async copy<T extends TAbstractFile>(file: T, _newPath: string): Promise<T> {
    return file;
  }

  async create(path: string, _data: string): Promise<TFile> {
    const f = new TFile();
    f.path = path;
    return f;
  }

  async createBinary(path: string, _data: ArrayBuffer): Promise<TFile> {
    const f = new TFile();
    f.path = path;
    return f;
  }

  async createFolder(path: string): Promise<TFolder> {
    const f = new TFolder();
    f.path = path;
    return f;
  }

  async delete(_file: TAbstractFile, _force?: boolean): Promise<void> {}

  getAbstractFileByPath(path: string): null | TAbstractFile {
    return this.fileMap[path] ?? null;
  }

  getAllFolders(_includeRoot?: boolean): TFolder[] {
    return Object.values(this.fileMap).filter((f): f is TFolder => f instanceof TFolder);
  }

  getAllLoadedFiles(): TAbstractFile[] {
    return Object.values(this.fileMap);
  }

  getAvailablePath(base: string, _ext: string): string {
    return base;
  }

  getFileByPath(path: string): null | TFile {
    const f = this.fileMap[path];
    return f instanceof TFile ? f : null;
  }

  getFiles(): TFile[] {
    return Object.values(this.fileMap).filter((f): f is TFile => f instanceof TFile);
  }

  getFolderByPath(path: string): null | TFolder {
    const f = this.fileMap[path];
    return f instanceof TFolder ? f : null;
  }

  getMarkdownFiles(): TFile[] {
    return Object.values(this.fileMap).filter((f): f is TFile => f instanceof TFile && f.extension === 'md');
  }

  getName(): string {
    return '';
  }

  getResourcePath(_file: TFile): string {
    return '';
  }

  getRoot(): TFolder {
    const root = new TFolder();
    root.path = '/';
    return root;
  }

  async modify(_file: TFile, _data: string): Promise<void> {}
  async modifyBinary(_file: TFile, _data: ArrayBuffer): Promise<void> {}

  async process(_file: TFile, fn: (data: string) => string): Promise<string> {
    return fn('');
  }

  async read(_file: TFile): Promise<string> {
    return '';
  }

  async readBinary(_file: TFile): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  async rename(_file: TAbstractFile, _newPath: string): Promise<void> {}
  async trash(_file: TAbstractFile, _system: boolean): Promise<void> {}
}
