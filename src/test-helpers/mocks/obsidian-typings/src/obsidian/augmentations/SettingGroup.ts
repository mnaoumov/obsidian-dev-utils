import { SettingGroup } from 'obsidian-test-mocks/obsidian';

import { ensureGenericObject } from '../../../../../../type-guards.ts';
import { mockImplementation } from '../../../../../mock-implementation.ts';

mockImplementation(
  SettingGroup.prototype,
  'constructor__',
  function initSettingGroup(this: SettingGroup, originalImplementation, containerEl: HTMLElement): SettingGroup {
    originalImplementation.call(this, containerEl);
    // @ts-expect-error -- listEl__ is mock-only from obsidian-test-mocks, listEl is from obsidian-typings.
    ensureGenericObject(this).listEl = this.listEl__;
    return this;
  }
);
