import type { TFolder } from './TFolder.ts';
import type { Vault } from './Vault.ts';

import { castTo } from '../../src/ObjectUtils.ts';

export class TAbstractFile {
  public name = '';
  public parent: null | TFolder = null;
  public path = '';
  public vault: Vault = castTo<Vault>(null);
}
