import type {
  App,
  TFile
} from 'obsidian';

import { TFile as MockTFile } from '../../obsidian/TFile.ts';
import { createTFolderInstance } from './createTFolderInstance.ts';
import { parentFolderPath } from './parentFolderPath.ts';

export function createTFileInstance(app: App, path: string): TFile {
  let file = app.vault.getFileByPath(path);
  if (file) {
    return file;
  }

  // eslint-disable-next-line @typescript-eslint/no-deprecated, obsidianmd/no-tfile-tfolder-cast -- Mock implementation requires deprecated constructor and cast.
  file = new MockTFile(app.vault, path) as TFile;
  file.parent = createTFolderInstance(app, parentFolderPath(path));
  file.deleted = true;
  return file;
}
