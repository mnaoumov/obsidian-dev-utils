import type { ListedFiles } from 'obsidian';

export class DataAdapter {
  public basePath = '';
  public insensitive = false;

  public async append(_normalizedPath: string, _data: string): Promise<void> {}
  public async copy(_normalizedPath: string, _normalizedNewPath: string): Promise<void> {}
  public async exists(_normalizedPath: string, _sensitive?: boolean): Promise<boolean> {
    return false;
  }

  public getName(): string {
    return '';
  }

  public getResourcePath(_normalizedPath: string): string {
    return '';
  }

  public async list(_normalizedPath: string): Promise<ListedFiles> {
    return { files: [], folders: [] };
  }

  public async mkdir(_normalizedPath: string): Promise<void> {}
  public async process(_normalizedPath: string, fn: (data: string) => string): Promise<string> {
    return fn('');
  }

  public async read(_normalizedPath: string): Promise<string> {
    return '';
  }

  public async readBinary(_normalizedPath: string): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  public async remove(_normalizedPath: string): Promise<void> {}
  public async rename(_normalizedPath: string, _normalizedNewPath: string): Promise<void> {}
  public async rmdir(_normalizedPath: string, _recursive: boolean): Promise<void> {}
  public async stat(_normalizedPath: string): Promise<{ ctime: number; mtime: number; size: number } | null> {
    return null;
  }

  public async trashLocal(_normalizedPath: string): Promise<void> {}
  public async trashSystem(_normalizedPath: string): Promise<boolean> {
    return false;
  }

  public async write(_normalizedPath: string, _data: string): Promise<void> {}
  public async writeBinary(_normalizedPath: string, _data: ArrayBuffer): Promise<void> {}
}
