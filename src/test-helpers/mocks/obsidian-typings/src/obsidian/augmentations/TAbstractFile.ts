/**
 * @packageDocumentation
 *
 * Bridges the `deleted` property from the Obsidian API onto the mock
 * `TAbstractFile` via the internal `deleted__` field.
 */

import { TAbstractFile } from 'obsidian-test-mocks/obsidian';

import { ensureGenericObject } from '../../../../../../type-guards.ts';
import { mockImplementation } from '../../../../../mock-implementation.ts';

/**
 * Patches TAbstractFile to expose `deleted` from the Obsidian API.
 */
export function mockTAbstractFile(): void {
  mockImplementation(
    TAbstractFile.prototype,
    'constructor__',
    function initTAbstractFile(this: TAbstractFile, originalImplementation, ...args: Parameters<TAbstractFile['constructor__']>): void {
      originalImplementation.call(this, ...args);
      Object.defineProperty(this, 'deleted', {
        configurable: true,
        enumerable: true,
        get: (): boolean => this.deleted__,
        set: (value: boolean): void => {
          ensureGenericObject(this).deleted__ = value;
        }
      });
    }
  );
}
