import type { TFolder } from './t-folder.ts';
import type { Vault } from './vault.ts';

export abstract class TAbstractFile {
  public deleted = true;
  public name: string;
  public parent: null | TFolder = null;
  public path: string;
  public vault: Vault;

  /** @deprecated Mock-only constructor. TAbstractFile has no public constructor in the Obsidian API. */
  public constructor(vault: Vault, path: string) {
    this.vault = vault;
    this.path = path;
    const parts = path.split('/');
    this.name = parts[parts.length - 1] ?? '';
  }
}
