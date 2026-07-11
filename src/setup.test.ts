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
import { noop } from './function.ts';
import { Library } from './library.ts';
import { getObsidianDevUtilsState } from './obsidian-dev-utils-state.ts';
import {
  restoreConsole,
  setup,
  silenceConsole
} from './setup.ts';

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
    expect(beforeEachRegistrar).toHaveBeenCalledWith(expect.any(Function));
    expect(afterEachRegistrar).toHaveBeenCalledTimes(1);
    expect(afterEachRegistrar).toHaveBeenCalledWith(expect.any(Function));
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
    Library.init({ cssClassScope: 'mutated-scope', debugPrefixNamespace: '', shouldPrintStackTrace: false });

    beforeEachCallback?.();

    const after = getObsidianDevUtilsState('setup-test-key', 'b');
    expect(after).not.toBe(before);
    expect(after.value).toBe('b');
    expect(Library.cssClassScope).toBe('');

    await expect(waitForAllAsyncOperations()).resolves.toBeUndefined();

    afterEachCallback?.();
    await expect(waitForAllAsyncOperations()).rejects.toThrow('Async operation tracking is not enabled');
  });
});

describe('silenceConsole / restoreConsole', () => {
  afterEach(() => {
    restoreConsole();
  });

  it('should replace all console methods with noop and restore the originals', () => {
    restoreConsole();

    // Read console methods via descriptors (bare `console`) to avoid `no-console` member-access lint errors.
    const originalLogDescriptor = Object.getOwnPropertyDescriptor(console, 'log');
    const originalInfoDescriptor = Object.getOwnPropertyDescriptor(console, 'info');
    expect(originalLogDescriptor?.value).not.toBe(noop);
    expect(originalInfoDescriptor?.value).not.toBe(noop);

    silenceConsole();

    for (const methodName of ['assert', 'debug', 'dir', 'error', 'info', 'log', 'trace', 'warn'] as const) {
      expect(Object.getOwnPropertyDescriptor(console, methodName)?.value).toBe(noop);
    }

    restoreConsole();

    expect(Object.getOwnPropertyDescriptor(console, 'log')?.value).toBe(originalLogDescriptor?.value);
    expect(Object.getOwnPropertyDescriptor(console, 'info')?.value).toBe(originalInfoDescriptor?.value);
  });
});
