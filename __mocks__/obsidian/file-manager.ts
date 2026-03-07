import type { DataWriteOptions } from 'obsidian';

import type { App } from './app.ts';
import type { TAbstractFile } from './t-abstract-file.ts';
import type { TFile } from './t-file.ts';
import type { TFolder } from './t-folder.ts';

import { noopAsync } from '../../src/function.ts';

export class FileManager {
  public app: App;

  public constructor(app: App) {
    this.app = app;
  }

  public generateMarkdownLink(_file: TFile, _sourcePath: string, _subpath?: string, _alias?: string): string {
    return '';
  }

  public async getAvailablePathForAttachment(_filename: string, _sourcePath?: string): Promise<string> {
    return '';
  }

  public getNewFileParent(_sourcePath: string, _newFilePath?: string): TFolder {
    return this.app.vault.getRoot();
  }

  public async processFrontMatter(_file: TFile, _fn: (frontmatter: unknown) => void, _options?: DataWriteOptions): Promise<void> {
    await noopAsync();
  }

  public async promptForDeletion(_file: TAbstractFile): Promise<void> {
    await noopAsync();
  }

  public async renameFile(_file: TAbstractFile, _newPath: string): Promise<void> {
    await noopAsync();
  }

  public async trashFile(_file: TAbstractFile): Promise<void> {
    await noopAsync();
  }
}
