import type { App } from './App.ts';
import type { TAbstractFile } from './TAbstractFile.ts';
import type { TFile } from './TFile.ts';
import type { TFolder } from './TFolder.ts';

import { noopAsync } from '../../src/Function.ts';

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

  public async processFrontMatter(_file: TFile, _fn: (frontmatter: unknown) => void): Promise<void> {
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
