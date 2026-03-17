/**
 * @packageDocumentation
 *
 * Bridges the `listEl` property from `obsidian-typings` onto the mock
 * `SettingGroup` via the internal `listEl__` field.
 */

import { SettingGroup } from 'obsidian-test-mocks/obsidian';

import { defineMissingProperty } from './define-missing-property.ts';

/**
 * Patches SettingGroup prototype to expose `listEl` from obsidian-typings.
 */
export function mockSettingGroup(): void {
  defineMissingProperty(SettingGroup.prototype, 'listEl', {
    get(this: SettingGroup): HTMLElement {
      return this.listEl__;
    }
  });
}
