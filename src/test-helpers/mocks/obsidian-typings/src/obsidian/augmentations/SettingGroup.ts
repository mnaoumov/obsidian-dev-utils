import { SettingGroup } from 'obsidian-test-mocks/obsidian';

import { mockImplementation } from '../../../../../mock-implementation.ts';

mockImplementation(
  SettingGroup.prototype,
  'constructor__',
  function initSettingGroup(this: SettingGroup, originalImplementation, containerEl: HTMLElement): void {
    originalImplementation.call(this, containerEl);
    this.asOriginalType__().listEl = this.listEl__;
  }
);
