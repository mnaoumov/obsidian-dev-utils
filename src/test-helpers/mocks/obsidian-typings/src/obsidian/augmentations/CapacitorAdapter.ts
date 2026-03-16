/**
 * @packageDocumentation
 *
 * Bridges the `insensitive` property from `obsidian-typings` DataAdapterEx
 * onto the mock CapacitorAdapter via `insensitive__` from InMemoryAdapter.
 */

import { CapacitorAdapter } from 'obsidian-test-mocks/obsidian';

import { ensureGenericObject } from '../../../../../../type-guards.ts';
import { mockImplementation } from '../../../../../mock-implementation.ts';

/**
 * Patches CapacitorAdapter to expose `insensitive` from obsidian-typings.
 */
export function mockCapacitorAdapter(): void {
  mockImplementation(
    CapacitorAdapter.prototype,
    'constructor__',
    function initCapacitorAdapter(this: CapacitorAdapter, originalImplementation, basePath: string, fs: unknown): void {
      originalImplementation.call(this, basePath, fs);
      Object.defineProperty(this, 'insensitive', {
        get: (): boolean => this.insensitive__,
        set: (value: boolean): void => {
          ensureGenericObject(this).insensitive__ = value;
        }
      });
    }
  );
}
