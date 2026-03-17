/**
 * @packageDocumentation
 *
 * Bridges the `insensitive` property from `obsidian-typings` DataAdapterEx
 * onto the mock FileSystemAdapter via `insensitive__` from InMemoryAdapter.
 */

import { FileSystemAdapter } from 'obsidian-test-mocks/obsidian';

import { defineMissingProperty } from './define-missing-property.ts';

/**
 * Patches FileSystemAdapter prototype to expose `insensitive` from obsidian-typings.
 */
export function mockFileSystemAdapter(): void {
  defineMissingProperty(FileSystemAdapter.prototype, 'insensitive', {
    get(this: FileSystemAdapter): boolean {
      return this.insensitive__;
    },
    set(this: FileSystemAdapter, value: boolean): void {
      this.insensitive__ = value;
    }
  });
}
