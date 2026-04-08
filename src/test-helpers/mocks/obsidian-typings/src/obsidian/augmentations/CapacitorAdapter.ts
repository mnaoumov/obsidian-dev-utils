/**
 * @file
 *
 * Bridges the `insensitive` property from `obsidian-typings` DataAdapterEx
 * onto the mock CapacitorAdapter via `insensitive__` from InMemoryAdapter.
 */

import { CapacitorAdapter } from 'obsidian-test-mocks/obsidian';

import { defineMissingProperty } from './define-missing-property.ts';

/**
 * Patches CapacitorAdapter prototype to expose `insensitive` from obsidian-typings.
 */
export function mockCapacitorAdapter(): void {
  defineMissingProperty(CapacitorAdapter.prototype, 'insensitive', {
    get(this: CapacitorAdapter): boolean {
      return this.insensitive__;
    },
    set(this: CapacitorAdapter, value: boolean): void {
      this.insensitive__ = value;
    }
  });
}
