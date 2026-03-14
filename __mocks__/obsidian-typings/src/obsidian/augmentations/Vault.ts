import type {
  DataAdapter,
  TAbstractFile
} from 'obsidian';

import { Vault } from 'obsidian';
import { vi } from 'vitest';

import { ensureGenericObject } from '../../../../../src/type-guards.ts';

vi.spyOn(Vault.prototype, 'constructor2__').mockImplementation(function initVault(this: Vault, _adapter: DataAdapter): Vault {
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
