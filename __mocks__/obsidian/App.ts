import type { TAbstractFile } from './TAbstractFile.ts';

import { TFile } from './TFile.ts';
import { TFolder } from './TFolder.ts';
import { Vault } from './Vault.ts';

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
  fileManager = {
    renameFile(_file: TAbstractFile, _newPath: string): Promise<void> {
      return Promise.resolve();
    }
  };

  internalPlugins = {
    getEnabledPluginById(_id: string): unknown {
      return null;
    }
  };

  metadataCache = {
    fileToLinktext(file: TFile, _sourcePath: string, _omitMdExt?: boolean): string {
      return file.basename;
    },
    getCache(_path: string): unknown {
      return null;
    },
    getFirstLinkpathDest(_linkpath: string, _sourcePath: string): null | TFile {
      return null;
    }
  };

  vault = new Vault();
  workspace = {
    getLeaf(): unknown {
      return {};
    },
    getLeavesOfType(_type: string): unknown[] {
      return [];
    },
    on(_event: string, _cb: (...args: unknown[]) => void): unknown {
      return {};
    }
  };
}

export function createMockApp(options: MockAppOptions = {}): App {
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

  return app;
}
