import { TAbstractFile } from './TAbstractFile.ts';

export class TFile extends TAbstractFile {
  basename = '';
  extension = '';
  stat = { ctime: 0, mtime: 0, size: 0 };
}
