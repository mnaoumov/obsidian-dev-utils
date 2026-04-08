/**
 * @file
 *
 * Bridges the `deleted` property from the Obsidian API onto the mock
 * `TAbstractFile` via the internal `deleted__` field.
 */

import { TAbstractFile } from 'obsidian-test-mocks/obsidian';

import { defineMissingProperty } from './define-missing-property.ts';

/**
 * Patches TAbstractFile prototype to expose `deleted` from the Obsidian API.
 */
export function mockTAbstractFile(): void {
  defineMissingProperty(TAbstractFile.prototype, 'deleted', {
    get(this: TAbstractFile): boolean {
      return this.deleted__;
    },
    set(this: TAbstractFile, value: boolean): void {
      this.deleted__ = value;
    }
  });
}
