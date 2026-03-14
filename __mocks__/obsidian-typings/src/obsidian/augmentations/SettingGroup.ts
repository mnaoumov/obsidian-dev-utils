import { SettingGroup } from 'obsidian';

import { mockImplementation } from '../../../../../src/test-helpers.ts';
import { ensureGenericObject } from '../../../../../src/type-guards.ts';

// @ts-expect-error -- constructor__ is a mock-only hook from obsidian-test-mocks.
mockImplementation(
  SettingGroup.prototype,
  'constructor__',
  function initSettingGroup(this: SettingGroup, originalImplementation, containerEl: HTMLElement): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- originalImplementation is untyped mock-only constructor hook.
    originalImplementation.call(this, containerEl);
    // @ts-expect-error -- listEl__ is mock-only from obsidian-test-mocks, listEl is from obsidian-typings.
    ensureGenericObject(this).listEl = this.listEl__;
  }
);
