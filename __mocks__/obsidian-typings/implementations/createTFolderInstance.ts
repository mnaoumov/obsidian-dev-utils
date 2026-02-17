import type {
  App,
  TFolder
} from 'obsidian';

import { TFolder as MockTFolder } from '../../obsidian/TFolder.ts';
import { parentFolderPath } from './parentFolderPath.ts';

export function createTFolderInstance(app: App, path: string): TFolder {
  let folder = app.vault.getFolderByPath(path);
  if (folder) {
    return folder;
  }

  // eslint-disable-next-line @typescript-eslint/no-deprecated, obsidianmd/no-tfile-tfolder-cast -- Mock implementation requires deprecated constructor and cast.
  folder = new MockTFolder(app.vault, path) as TFolder;
  if (path !== '/') {
    folder.parent = createTFolderInstance(app, parentFolderPath(path));
  }
  folder.deleted = true;
  return folder;
}
