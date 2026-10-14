import type { HookRegistrar } from '@mnaoumov/typescript-test-toolkit/setup';

import { ObsidianLibrary } from '@mnaoumov/obsidian-lib/library';
import { getObsidianDevUtilsState } from '@mnaoumov/obsidian-lib/obsidian-dev-utils-state';
import { noop } from '@mnaoumov/typescript-lib/function';
import { assertNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { setup } from './setup.ts';

const { mockSetupGeneric } = vi.hoisted(() => ({
  mockSetupGeneric: vi.fn()
}));

vi.mock('@mnaoumov/typescript-test-toolkit/setup', () => ({
  setup: mockSetupGeneric
}));

describe('setup', () => {
  it('should register the Obsidian reset before handing the hooks to the generic setup', () => {
    const order: string[] = [];
    const beforeEach = vi.fn<HookRegistrar>(() => {
      order.push('obsidian beforeEach');
    });
    mockSetupGeneric.mockImplementation(() => {
      order.push('generic setup');
    });

    const params = { afterAll: noop, afterEach: noop, beforeEach };
    setup(params);

    expect(order).toEqual(['obsidian beforeEach', 'generic setup']);
    expect(mockSetupGeneric).toHaveBeenCalledWith(params);
  });

  it('should reset the __obsidianDevUtils bag and the Obsidian library context before each test', async () => {
    let beforeEachCallback: Parameters<HookRegistrar>[0] | undefined;
    setup({
      afterAll: noop,
      afterEach: noop,
      beforeEach: ($function) => {
        beforeEachCallback = $function;
      }
    });

    const before = getObsidianDevUtilsState('setup-test-key', 'a');
    before.value = 'mutated';
    ObsidianLibrary.init({ cssClassScope: 'mutated-scope' });

    assertNonNullable(beforeEachCallback);
    await beforeEachCallback();

    const after = getObsidianDevUtilsState('setup-test-key', 'b');
    expect(after).not.toBe(before);
    expect(after.value).toBe('b');
    expect(ObsidianLibrary.cssClassScope).toBe('');
  });
});
