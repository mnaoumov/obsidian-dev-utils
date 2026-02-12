import type { TAbstractFile } from './TAbstractFile.ts';
import type { TFile } from './TFile.ts';
import type { TFolder } from './TFolder.ts';

export class FileManager {
  public generateMarkdownLink(_file: TFile, _sourcePath: string, _subpath?: string, _alias?: string): string {
    return '';
  }

  public async getAvailablePathForAttachment(_filename: string, _sourcePath?: string): Promise<string> {
    return '';
  }

  public getNewFileParent(_sourcePath: string, _newFilePath?: string): TFolder {
    return null as unknown as TFolder;
  }

  public async processFrontMatter(_file: TFile, _fn: (frontmatter: unknown) => void): Promise<void> {}

  public async promptForDeletion(_file: TAbstractFile): Promise<void> {}

  public async renameFile(_file: TAbstractFile, _newPath: string): Promise<void> {}

  public async trashFile(_file: TAbstractFile): Promise<void> {}
}
