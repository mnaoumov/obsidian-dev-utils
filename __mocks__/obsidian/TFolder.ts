import { TAbstractFile } from './TAbstractFile.ts';

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
  isRoot(): boolean {
    return this.path === '' || this.path === '/';
  }
}
