import { SettingGroup } from 'obsidian';
import { vi } from 'vitest';

import { ensureGenericObject } from '../../../../../src/type-guards.ts';

vi.spyOn(SettingGroup.prototype, 'constructor__').mockImplementation(function initSettingGroup(this: SettingGroup, _containerEl: HTMLElement): SettingGroup {
  // @ts-expect-error -- listEl__ is mock-only from obsidian-test-mocks, listEl is from obsidian-typings.
  ensureGenericObject(this).listEl = this.listEl__;
  return this;
});
