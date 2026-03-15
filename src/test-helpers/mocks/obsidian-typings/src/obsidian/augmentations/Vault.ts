import type { DataAdapter } from 'obsidian';

import { Vault } from 'obsidian-test-mocks/obsidian';

import { ensureGenericObject } from '../../../../../../type-guards.ts';
import { mockImplementation } from '../../../../../mock-implementation.ts';

mockImplementation(Vault.prototype, 'constructor2__', function initVault(this: Vault, originalImplementation, _adapter: DataAdapter): Vault {
  originalImplementation.call(this, _adapter);
  ensureGenericObject(this)['getAbstractFileByPathInsensitive'] = this.getAbstractFileByPathInsensitive__.bind(this);
  return this;
});
