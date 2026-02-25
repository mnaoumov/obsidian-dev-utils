import type { UserEvent } from 'obsidian';

import { App as ObsidianApp } from 'obsidian';

import { noop } from '../../src/Function.ts';
import { castTo } from '../../src/ObjectUtils.ts';
import { FileManager } from './FileManager.ts';
import { Keymap } from './Keymap.ts';
import { MetadataCache } from './MetadataCache.ts';
import { Scope } from './Scope.ts';
import { TFile } from './TFile.ts';
import { TFolder } from './TFolder.ts';
import {
  setVaultAbstractFile,
  Vault
} from './Vault.ts';
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
  public lastEvent: null | UserEvent = null;
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
  const fileContents = new Map<string, string>();

  for (const folderPath of options.folders ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Creating mock file system entries.
    const folder = new TFolder(app.vault, folderPath);
    setVaultAbstractFile(app.vault, folderPath, folder);
  }

  for (const fileOpt of options.files ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Creating mock file system entries.
    const file = new TFile(app.vault, fileOpt.path);
    setVaultAbstractFile(app.vault, fileOpt.path, file);
    if (fileOpt.content !== undefined) {
      fileContents.set(fileOpt.path, fileOpt.content);
    }
  }
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
