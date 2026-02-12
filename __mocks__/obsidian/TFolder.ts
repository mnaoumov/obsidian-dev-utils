import { TAbstractFile } from './TAbstractFile.ts';

export class TFolder extends TAbstractFile {
  public children: TAbstractFile[] = [];
  public isRoot(): boolean {
    return this.path === '' || this.path === '/';
  }
}
