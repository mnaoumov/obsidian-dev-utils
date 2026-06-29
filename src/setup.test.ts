import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  disableAsyncOperationTracking,
  waitForAllAsyncOperations
} from './async.ts';
import { globalState } from './library.ts';
import { getObsidianDevUtilsState } from './obsidian-dev-utils-state.ts';
import { setup } from './setup.ts';

describe('setup', () => {
  afterEach(() => {
    disableAsyncOperationTracking();
  });

  it('should register handlers with the provided hooks', () => {
    const beforeEachRegistrar = vi.fn<(fn: () => void) => void>();
    const afterEachRegistrar = vi.fn<(fn: () => void) => void>();

    setup({
      afterEach: afterEachRegistrar,
      beforeEach: beforeEachRegistrar
    });

    expect(beforeEachRegistrar).toHaveBeenCalledTimes(1);
    expect(afterEachRegistrar).toHaveBeenCalledTimes(1);
    expect(afterEachRegistrar).toHaveBeenCalledWith(disableAsyncOperationTracking);
  });

  it('should reset state and enable tracking via beforeEach, and disable tracking via afterEach', async () => {
    let beforeEachCallback: (() => void) | undefined;
    let afterEachCallback: (() => void) | undefined;

    const beforeEachRegistrar = vi.fn<(fn: () => void) => void>((fn) => {
      beforeEachCallback = fn;
    });
    const afterEachRegistrar = vi.fn<(fn: () => void) => void>((fn) => {
      afterEachCallback = fn;
    });

    setup({
      afterEach: afterEachRegistrar,
      beforeEach: beforeEachRegistrar
    });

    expect(beforeEachCallback).toBeDefined();
    expect(afterEachCallback).toBeDefined();

    const before = getObsidianDevUtilsState('setup-test-key', 'a');
    before.value = 'mutated';
    globalState.cssClassScope = 'mutated-scope';

    beforeEachCallback?.();

    const after = getObsidianDevUtilsState('setup-test-key', 'b');
    expect(after).not.toBe(before);
    expect(after.value).toBe('b');
    expect(globalState.cssClassScope).toBe('');

    await expect(waitForAllAsyncOperations()).resolves.toBeUndefined();

    afterEachCallback?.();
    await expect(waitForAllAsyncOperations()).rejects.toThrow('Async operation tracking is not enabled');
  });
});
