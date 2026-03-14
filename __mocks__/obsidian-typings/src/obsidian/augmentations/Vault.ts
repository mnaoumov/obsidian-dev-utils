import type { TAbstractFile } from 'obsidian';

import { Vault } from 'obsidian';

import { mockImplementation } from '../../../../../src/test-helpers.ts';
import { ensureGenericObject } from '../../../../../src/type-guards.ts';

// @ts-expect-error -- constructor2__ is a mock-only hook from obsidian-test-mocks.
mockImplementation(Vault.prototype, 'constructor2__', function initVault(this: Vault, originalImplementation): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- originalImplementation is untyped mock-only constructor hook.
  originalImplementation.call(this);
  ensureGenericObject(this).getAbstractFileByPathInsensitive = function getAbstractFileByPathInsensitive(path: string): null | TAbstractFile {
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
});
