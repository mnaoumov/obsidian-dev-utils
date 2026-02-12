import type { App as ObsidianApp } from 'obsidian';

import type { TAbstractFile } from './TAbstractFile.ts';

import { FileManager } from './FileManager.ts';
import { Keymap } from './Keymap.ts';
import { MetadataCache } from './MetadataCache.ts';
import { Scope } from './Scope.ts';
import { TFile } from './TFile.ts';
import { TFolder } from './TFolder.ts';
import { Vault } from './Vault.ts';
import { Workspace } from './Workspace.ts';

export interface MockAppOptions {
  files?: MockFileEntry[];
  folders?: string[];
}

export interface MockFileEntry {
  content?: string;
  extension?: string;
  path: string;
}

export class App {
  fileManager = new FileManager();
  keymap = new Keymap();
  lastEvent: unknown = null;
  metadataCache = new MetadataCache();
  scope = new Scope();
  vault = new Vault();
  workspace = new Workspace();

  isDarkMode(): boolean {
    return false;
  }

  loadLocalStorage(_key: string): unknown {
    return null;
  }

  saveLocalStorage(_key: string, _data: unknown): void {}
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
  app.vault.getAbstractFileByPath = (path: string): null | TAbstractFile => {
    return fileMap[path] ?? null;
  };
  app.vault.cachedRead = async (file: TFile): Promise<string> => {
    return fileContents.get(file.path) ?? '';
  };
  app.vault.read = async (file: TFile): Promise<string> => {
    return fileContents.get(file.path) ?? '';
  };

  app.metadataCache.getFirstLinkpathDest = (linkpath: string, _sourcePath: string): null | TFile => {
    const found = fileMap[linkpath];
    if (found instanceof TFile) {
      return found;
    }
    const withMd = fileMap[`${linkpath}.md`];
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
