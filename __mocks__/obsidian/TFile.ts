import type { FileStats } from 'obsidian';

import type { Vault } from './Vault.ts';

import { TAbstractFile } from './TAbstractFile.ts';

export class TFile extends TAbstractFile {
  public basename: string;
  public extension: string;
  public stat: FileStats = { ctime: 0, mtime: 0, size: 0 };

  /** @deprecated Mock-only constructor. TFile has no public constructor in the Obsidian API. */
  public constructor(vault: Vault, path: string) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Calling mock-only @deprecated TAbstractFile constructor.
    super(vault, path);
    const dotIndex = this.name.lastIndexOf('.');
    this.extension = dotIndex >= 0 ? this.name.slice(dotIndex + 1) : '';
    this.basename = dotIndex >= 0 ? this.name.slice(0, dotIndex) : this.name;
  }
}
