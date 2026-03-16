import type {
  DataAdapter,
  TAbstractFile
} from 'obsidian';

import { Vault } from 'obsidian-test-mocks/obsidian';

import { mockImplementation } from '../../../../../mock-implementation.ts';

mockImplementation(Vault.prototype, 'constructor2__', function initVault(this: Vault, originalImplementation, adapter: DataAdapter): void {
  originalImplementation.call(this, adapter);
  this.asOriginalType__().getAbstractFileByPathInsensitive = (path): null | TAbstractFile =>
    this.getAbstractFileByPathInsensitive__(path)?.asOriginalType__() ?? null;
});
