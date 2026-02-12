import type { ListedFiles } from 'obsidian';

export class DataAdapter {
  basePath = '';
  insensitive = false;

  async append(_normalizedPath: string, _data: string): Promise<void> {}
  async copy(_normalizedPath: string, _normalizedNewPath: string): Promise<void> {}
  async exists(_normalizedPath: string, _sensitive?: boolean): Promise<boolean> {
    return false;
  }
  getName(): string {
    return '';
  }
  getResourcePath(_normalizedPath: string): string {
    return '';
  }
  async list(_normalizedPath: string): Promise<ListedFiles> {
    return { files: [], folders: [] };
  }
  async mkdir(_normalizedPath: string): Promise<void> {}
  async process(_normalizedPath: string, fn: (data: string) => string): Promise<string> {
    return fn('');
  }
  async read(_normalizedPath: string): Promise<string> {
    return '';
  }
  async readBinary(_normalizedPath: string): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }
  async remove(_normalizedPath: string): Promise<void> {}
  async rename(_normalizedPath: string, _normalizedNewPath: string): Promise<void> {}
  async rmdir(_normalizedPath: string, _recursive: boolean): Promise<void> {}
  async stat(_normalizedPath: string): Promise<{ ctime: number; mtime: number; size: number } | null> {
    return null;
  }
  async trashLocal(_normalizedPath: string): Promise<void> {}
  async trashSystem(_normalizedPath: string): Promise<boolean> {
    return false;
  }
  async write(_normalizedPath: string, _data: string): Promise<void> {}
  async writeBinary(_normalizedPath: string, _data: ArrayBuffer): Promise<void> {}
}
