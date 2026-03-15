import type { DataAdapter } from 'obsidian';

import { Vault } from 'obsidian-test-mocks/obsidian';

import { mockImplementation } from '../../../../../mock-implementation.ts';

mockImplementation(Vault.prototype, 'constructor2__', function initVault(this: Vault, originalImplementation, _adapter: DataAdapter): void {
  originalImplementation.call(this, _adapter);
  this.asOriginalType__().getAbstractFileByPathInsensitive = (path) => this.getAbstractFileByPathInsensitive__(path)?.asOriginalType__() ?? null;
});
