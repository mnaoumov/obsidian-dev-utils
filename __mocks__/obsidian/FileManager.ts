import type { TAbstractFile } from './TAbstractFile.ts';
import type { TFile } from './TFile.ts';
import type { TFolder } from './TFolder.ts';

export class FileManager {
  generateMarkdownLink(_file: TFile, _sourcePath: string, _subpath?: string, _alias?: string): string {
    return '';
  }

  async getAvailablePathForAttachment(_filename: string, _sourcePath?: string): Promise<string> {
    return '';
  }

  getNewFileParent(_sourcePath: string, _newFilePath?: string): TFolder {
    return null as unknown as TFolder;
  }

  async processFrontMatter(_file: TFile, _fn: (frontmatter: unknown) => void): Promise<void> {}

  async promptForDeletion(_file: TAbstractFile): Promise<void> {}

  async renameFile(_file: TAbstractFile, _newPath: string): Promise<void> {}

  async trashFile(_file: TAbstractFile): Promise<void> {}
}
