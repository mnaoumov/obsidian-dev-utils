/**
 * @packageDocumentation
 *
 * Bridges the `insensitive` property from `obsidian-typings` DataAdapterEx
 * onto the mock FileSystemAdapter via `insensitive__` from InMemoryAdapter.
 */

import { FileSystemAdapter } from 'obsidian-test-mocks/obsidian';

import { ensureGenericObject } from '../../../../../../type-guards.ts';
import { mockImplementation } from '../../../../../mock-implementation.ts';

/**
 * Patches FileSystemAdapter to expose `insensitive` from obsidian-typings.
 */
export function mockFileSystemAdapter(): void {
  mockImplementation(FileSystemAdapter.prototype, 'constructor__', function initFSAdapter(this: FileSystemAdapter, originalImplementation, basePath: string): void {
    originalImplementation.call(this, basePath);
    Object.defineProperty(this, 'insensitive', {
      get: (): boolean => this.insensitive__,
      set: (value: boolean): void => {
        ensureGenericObject(this)['insensitive__'] = value;
      }
    });
  });
}
