/**
 * @packageDocumentation
 *
 * Bridges Obsidian Vault API methods missing from the mock implementation.
 * Adds stub implementations of `getAvailablePath`, `exists`, and
 * `getAbstractFileByPathInsensitive` so that tests can spy on them.
 */

import type { TAbstractFile } from 'obsidian';

import { Vault } from 'obsidian-test-mocks/obsidian';

import { noopAsync } from '../../../../../../function.ts';
import { defineMissingProperty } from './define-missing-property.ts';

/**
 * Patches Vault prototype to expose methods from the Obsidian API that are
 * missing from the mock implementation.
 */
export function mockVault(): void {
  defineMissingProperty(Vault.prototype, 'getAvailablePath', {
    value(basePath: string, extension: string): string {
      return extension ? `${basePath}.${extension}` : basePath;
    },
    writable: true
  });

  defineMissingProperty(Vault.prototype, 'exists', {
    async value(this: Vault, normalizedPath: string, sensitive?: boolean): Promise<boolean> {
      await noopAsync();
      const file = sensitive ? this.getAbstractFileByPath(normalizedPath) : this.getAbstractFileByPathInsensitive__(normalizedPath);
      return file !== null;
    },
    writable: true
  });

  defineMissingProperty(Vault.prototype, 'getAbstractFileByPathInsensitive', {
    value(this: Vault, path: string): null | TAbstractFile {
      return this.getAbstractFileByPathInsensitive__(path)?.asOriginalType__() ?? null;
    },
    writable: true
  });
}
