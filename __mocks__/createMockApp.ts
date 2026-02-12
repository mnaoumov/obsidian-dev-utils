import type { App as ObsidianApp } from 'obsidian';

import {
  App,
  type TAbstractFile,
  TFile,
  TFolder
} from './obsidian.ts';

export interface MockFileEntry {
  path: string;
  content?: string;
  extension?: string;
}

export interface MockAppOptions {
  files?: MockFileEntry[];
  folders?: string[];
}

export function createMockApp(options: MockAppOptions = {}): ObsidianApp {
  const app = new App();
  const fileMap: Record<string, TAbstractFile> = {};
  const fileContents = new Map<string, string>();

  const root = new TFolder();
  root.path = '/';
  root.name = '';
  fileMap['/'] = root;

  for (const folderPath of options.folders ?? []) {
    const folder = new TFolder();
    folder.path = folderPath;
    const parts = folderPath.split('/');
    folder.name = parts[parts.length - 1] ?? '';
    fileMap[folderPath] = folder;
  }

  for (const fileOpt of options.files ?? []) {
    const file = new TFile();
    file.path = fileOpt.path;
    const parts = fileOpt.path.split('/');
    file.name = parts[parts.length - 1] ?? '';
    file.extension = fileOpt.extension ?? file.name.split('.').pop() ?? '';
    file.basename = file.name.replace(`.${file.extension}`, '');
    fileMap[fileOpt.path] = file;
    if (fileOpt.content !== undefined) {
      fileContents.set(fileOpt.path, fileOpt.content);
    }
  }

  app.vault.fileMap = fileMap;
  app.vault.getAbstractFileByPath = (path: string): TAbstractFile | null => {
    return fileMap[path] ?? null;
  };
  app.vault.cachedRead = async (file: TFile): Promise<string> => {
    return fileContents.get(file.path) ?? '';
  };
  app.vault.read = async (file: TFile): Promise<string> => {
    return fileContents.get(file.path) ?? '';
  };

  app.metadataCache.getFirstLinkpathDest = (linkpath: string, _sourcePath: string): TFile | null => {
    const found = fileMap[linkpath];
    if (found instanceof TFile) {
      return found;
    }
    const withMd = fileMap[linkpath + '.md'];
    if (withMd instanceof TFile) {
      return withMd;
    }
    for (const f of Object.values(fileMap)) {
      if (f instanceof TFile && (f.basename === linkpath || f.name === linkpath)) {
        return f;
      }
    }
    return null;
  };

  return app as unknown as ObsidianApp;
}
