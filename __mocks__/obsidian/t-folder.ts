import type { Vault } from './vault.ts';

import { TAbstractFile } from './t-abstract-file.ts';

export class TFolder extends TAbstractFile {
  public children: TAbstractFile[] = [];

  /** @deprecated Mock-only constructor. TFolder has no public constructor in the Obsidian API. */
  public constructor(vault: Vault, path: string) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Calling mock-only @deprecated TAbstractFile constructor.
    super(vault, path);
  }

  public isRoot(): boolean {
    return this.path === '' || this.path === '/';
  }
}
