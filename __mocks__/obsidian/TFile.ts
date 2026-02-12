import { TAbstractFile } from './TAbstractFile.ts';

export class TFile extends TAbstractFile {
  public basename = '';
  public extension = '';
  public stat = { ctime: 0, mtime: 0, size: 0 };
}
