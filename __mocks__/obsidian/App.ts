import type { App as ObsidianApp } from 'obsidian';

import type { TAbstractFile } from './TAbstractFile.ts';

import { noop } from '../../src/Function.ts';
import { castTo } from '../../src/ObjectUtils.ts';
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
  public fileManager = new FileManager(this);
  public keymap = new Keymap();
  public lastEvent: unknown = null;
  public metadataCache = new MetadataCache();
  public scope = new Scope();
  public vault = new Vault();
  public workspace = new Workspace();

  public isDarkMode(): boolean {
    return false;
  }

  public loadLocalStorage(_key: string): unknown {
    return null;
  }

  public saveLocalStorage(_key: string, _data: unknown): void {
    noop();
  }
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
  app.vault.cachedRead = async (file: TFile): Promise<string> => {
    return fileContents.get(file.path) ?? '';
  };
  app.vault.read = async (file: TFile): Promise<string> => {
    return fileContents.get(file.path) ?? '';
  };

  app.metadataCache.getFirstLinkpathDest = (linkpath: string, _sourcePath: string): null | TFile => {
    const found = app.vault.getFileByPath(linkpath);
    if (found) {
      return found;
    }
    const withMd = app.vault.getFileByPath(`${linkpath}.md`);
    if (withMd) {
      return withMd;
    }
    for (const f of app.vault.getFiles()) {
      if (f.basename === linkpath || f.name === linkpath) {
        return f;
      }
    }
    return null;
  };

  return castTo<ObsidianApp>(app);
}
