import { SettingGroup } from 'obsidian-test-mocks/obsidian';

import { ensureGenericObject } from '../../../../../../type-guards.ts';
import { mockImplementation } from '../../../../../mock-implementation.ts';

mockImplementation(
  SettingGroup.prototype,
  'constructor__',
  function initSettingGroup(this: SettingGroup, originalImplementation, containerEl: HTMLElement): void {
    originalImplementation.call(this, containerEl);
    // ListEl__ (HTMLElement) bridges to listEl (HTMLDivElement) from obsidian-typings.
    ensureGenericObject(this)['listEl'] = this.listEl__;
  }
);
