import type { TAbstractFile } from './TAbstractFile.ts';

import { noopAsync } from '../../src/Function.ts';
import { DataAdapter } from './DataAdapter.ts';
import { Events } from './Events.ts';
import { TFile } from './TFile.ts';
import { TFolder } from './TFolder.ts';

export class Vault extends Events {
  public adapter: DataAdapter = new DataAdapter();
  // eslint-disable-next-line obsidianmd/hardcoded-config-path -- Default value for testing.
  public configDir = '.obsidian';
  public fileMap: Record<string, TAbstractFile> = {};

  public static recurseChildren(folder: TFolder, cb: (f: TAbstractFile) => unknown): void {
    for (const child of folder.children) {
      cb(child);
      if (child instanceof TFolder) {
        Vault.recurseChildren(child, cb);
      }
    }
  }

  public async append(_file: TFile, _data: string): Promise<void> {
    await noopAsync();
  }

  public async cachedRead(_file: TFile): Promise<string> {
    return '';
  }

  public async copy<T extends TAbstractFile>(file: T, _newPath: string): Promise<T> {
    return file;
  }

  public async create(path: string, _data: string): Promise<TFile> {
    const f = new TFile();
    f.path = path;
    return f;
  }

  public async createBinary(path: string, _data: ArrayBuffer): Promise<TFile> {
    const f = new TFile();
    f.path = path;
    return f;
  }

  public async createFolder(path: string): Promise<TFolder> {
    const f = new TFolder();
    f.path = path;
    return f;
  }

  public async delete(_file: TAbstractFile, _force?: boolean): Promise<void> {
    await noopAsync();
  }

  public async exists(_path: string): Promise<boolean> {
    return false;
  }

  public getAbstractFileByPath(path: string): null | TAbstractFile {
    return this.fileMap[path] ?? null;
  }

  public getAbstractFileByPathInsensitive(path: string): null | TAbstractFile {
    const lower = path.toLowerCase();
    for (const [key, value] of Object.entries(this.fileMap)) {
      if (key.toLowerCase() === lower) {
        return value;
      }
    }
    return null;
  }

  public getAllFolders(_includeRoot?: boolean): TFolder[] {
    return Object.values(this.fileMap).filter((f): f is TFolder => f instanceof TFolder);
  }

  public getAllLoadedFiles(): TAbstractFile[] {
    return Object.values(this.fileMap);
  }

  public getAvailablePath(base: string, _ext: string): string {
    return base;
  }

  public getFileByPath(path: string): null | TFile {
    const f = this.fileMap[path];
    return f instanceof TFile ? f : null;
  }

  public getFiles(): TFile[] {
    return Object.values(this.fileMap).filter((f): f is TFile => f instanceof TFile);
  }

  public getFolderByPath(path: string): null | TFolder {
    const f = this.fileMap[path];
    return f instanceof TFolder ? f : null;
  }

  public getMarkdownFiles(): TFile[] {
    return Object.values(this.fileMap).filter((f): f is TFile => f instanceof TFile && f.extension === 'md');
  }

  public getName(): string {
    return '';
  }

  public getResourcePath(_file: TFile): string {
    return '';
  }

  public getRoot(): TFolder {
    const root = new TFolder();
    root.path = '/';
    return root;
  }

  public async modify(_file: TFile, _data: string): Promise<void> {
    await noopAsync();
  }

  public async modifyBinary(_file: TFile, _data: ArrayBuffer): Promise<void> {
    await noopAsync();
  }

  public async process(_file: TFile, fn: (data: string) => string): Promise<string> {
    return fn('');
  }

  public async read(_file: TFile): Promise<string> {
    return '';
  }

  public async readBinary(_file: TFile): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  public async rename(_file: TAbstractFile, _newPath: string): Promise<void> {
    await noopAsync();
  }

  public async trash(_file: TAbstractFile, _system: boolean): Promise<void> {
    await noopAsync();
  }
}

export function deleteVaultAbstractFile(vault: Vault, path: string): void {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- This is a simple in-memory map for tests.
  delete vault.fileMap[path];
}

export function setVaultAbstractFile(vault: Vault, path: string, file: TAbstractFile): void {
  vault.fileMap[path] = file;
}
