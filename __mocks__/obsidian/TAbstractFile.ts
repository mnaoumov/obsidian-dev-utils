import type { TFolder } from './TFolder.ts';
import type { Vault } from './Vault.ts';

export class TAbstractFile {
  name = '';
  parent: null | TFolder = null;
  path = '';
  vault: Vault = null as unknown as Vault;
}
