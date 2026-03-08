import type { DataWriteOptions } from 'obsidian';

import type { TAbstractFile } from './TAbstractFile.ts';

import { noopAsync } from '../../src/function.ts';
import { DataAdapter } from './DataAdapter.ts';
import { Events } from './Events.ts';
import { TFile } from './TFile.ts';
import { TFolder } from './TFolder.ts';

export class Vault extends Events {
  public adapter: DataAdapter = new DataAdapter();
  // eslint-disable-next-line obsidianmd/hardcoded-config-path -- Default value for testing.
  public configDir = '.obsidian';
  public fileMap: Record<string, TAbstractFile> = {};

  public constructor() {
    super();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Creating root folder entry.
    const root = new TFolder(this, '/');
    this.fileMap['/'] = root;
    root.deleted = false;
  }

  public static recurseChildren(folder: TFolder, cb: (f: TAbstractFile) => unknown): void {
    for (const child of folder.children) {
      cb(child);
      if (child instanceof TFolder) {
        Vault.recurseChildren(child, cb);
      }
    }
  }

  public async append(_file: TFile, _data: string, _options?: DataWriteOptions): Promise<void> {
    await noopAsync();
  }

  public async cachedRead(_file: TFile): Promise<string> {
    return '';
  }

  public async copy<T extends TAbstractFile>(file: T, _newPath: string): Promise<T> {
    return file;
  }

  public async create(path: string, _data: string, _options?: DataWriteOptions): Promise<TFile> {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Calling mock-only @deprecated TFile constructor.
    const file = new TFile(this, path);
    setVaultAbstractFile(this, path, file);
    return file;
  }

  public async createBinary(path: string, _data: ArrayBuffer, _options?: DataWriteOptions): Promise<TFile> {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Calling mock-only @deprecated TFile constructor.
    const file = new TFile(this, path);
    setVaultAbstractFile(this, path, file);
    return file;
  }

  public async createFolder(path: string): Promise<TFolder> {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Calling mock-only @deprecated TFolder constructor.
    const folder = new TFolder(this, path);
    setVaultAbstractFile(this, path, folder);
    return folder;
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
    const root = this.fileMap['/'];
    if (root instanceof TFolder) {
      return root;
    }
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Fallback root folder creation.
    const fallback = new TFolder(this, '/');
    this.fileMap['/'] = fallback;
    return fallback;
  }

  public async modify(_file: TFile, _data: string, _options?: DataWriteOptions): Promise<void> {
    await noopAsync();
  }

  public async modifyBinary(_file: TFile, _data: ArrayBuffer, _options?: DataWriteOptions): Promise<void> {
    await noopAsync();
  }

  public async process(_file: TFile, fn: (data: string) => string, _options?: DataWriteOptions): Promise<string> {
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
  file.deleted = false;
  if (path !== '/' && path !== '') {
    const lastSlash = path.lastIndexOf('/');
    const parentKey = lastSlash > 0 ? path.slice(0, lastSlash) : '/';
    const parentFile = vault.fileMap[parentKey];
    if (parentFile instanceof TFolder) {
      file.parent = parentFile;
      parentFile.children.push(file);
    }
  }
}
