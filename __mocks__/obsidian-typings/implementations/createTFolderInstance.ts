import { TFolder } from '../../obsidian/TFolder.ts';

export function createTFolderInstance(_vault: unknown, path: string): TFolder {
  const folder = new TFolder();
  folder.path = path;
  const parts = path.split('/');
  folder.name = parts[parts.length - 1] ?? '';
  return folder;
}
