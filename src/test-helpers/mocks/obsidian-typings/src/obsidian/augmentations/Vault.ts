import type {
  DataAdapter,
  TAbstractFile
} from 'obsidian';

import { Vault } from 'obsidian-test-mocks/obsidian';

import { ensureGenericObject } from '../../../../../../type-guards.ts';
import { mockImplementation } from '../../../../../mock-implementation.ts';

mockImplementation(Vault.prototype, 'constructor2__', function initVault(this: Vault, originalImplementation, _adapter: DataAdapter): Vault {
  originalImplementation.call(this, _adapter);
  ensureGenericObject(this)['getAbstractFileByPathInsensitive'] = function getAbstractFileByPathInsensitive(path: string): null | TAbstractFile {
    const lowerPath = path.toLowerCase();
    // @ts-expect-error -- fileMap__ is a mock-only property from obsidian-test-mocks.
    const fileMap = this.fileMap__ as Record<string, TAbstractFile>;
    for (const [key, file] of Object.entries(fileMap)) {
      if (key.toLowerCase() === lowerPath) {
        return file;
      }
    }
    return null;
  };
  return this;
});
