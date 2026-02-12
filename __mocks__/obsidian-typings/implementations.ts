import {
  TFile,
  TFolder
} from '../obsidian.ts';

export function createTFileInstance(_vault: unknown, path: string): TFile {
  const file = new TFile();
  file.path = path;
  const parts = path.split('/');
  file.name = parts[parts.length - 1] ?? '';
  const dotIndex = file.name.lastIndexOf('.');
  file.extension = dotIndex >= 0 ? file.name.slice(dotIndex + 1) : '';
  file.basename = dotIndex >= 0 ? file.name.slice(0, dotIndex) : file.name;
  return file;
}

export function createTFolderInstance(_vault: unknown, path: string): TFolder {
  const folder = new TFolder();
  folder.path = path;
  const parts = path.split('/');
  folder.name = parts[parts.length - 1] ?? '';
  return folder;
}

export function parentFolderPath(path: string): string {
  const index = path.lastIndexOf('/');
  if (index === -1) {
    return '';
  }
  return path.slice(0, index);
}
