import { disableAsyncOperationTracking } from '@mnaoumov/typescript-test-toolkit/async-operation-tracking';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  ASYNC_OPERATION_HOOK_KEY,
  ASYNC_OPERATION_HOOK_VERSION,
  getAsyncOperationHook,
  notifyAsyncOperationStarted,
  setAsyncOperationHook
} from './async-operation-hook.ts';
import { noopAsync } from './function.ts';
import { castTo } from './object-utils.ts';

describe('async operation hook', () => {
  beforeEach(() => {
    // The shared setup installs the tracking hook before every test.
    disableAsyncOperationTracking();
  });

  afterEach(() => {
    setAsyncOperationHook(null);
  });

  it('should return null when no hook is installed', () => {
    expect(getAsyncOperationHook()).toBeNull();
  });

  it('should return the installed hook', () => {
    const hook = { onAsyncOperationStarted: vi.fn(), version: ASYNC_OPERATION_HOOK_VERSION };
    setAsyncOperationHook(hook);
    expect(getAsyncOperationHook()).toBe(hook);
  });

  it('should report a started operation to the installed hook', () => {
    const onAsyncOperationStarted = vi.fn();
    setAsyncOperationHook({ onAsyncOperationStarted, version: ASYNC_OPERATION_HOOK_VERSION });
    const operation = noopAsync();

    notifyAsyncOperationStarted(operation);

    expect(onAsyncOperationStarted).toHaveBeenCalledWith(operation);
  });

  it('should do nothing when no hook is installed', () => {
    expect(() => {
      notifyAsyncOperationStarted(noopAsync());
    }).not.toThrow();
  });

  it('should keep the hook in a global slot under a registry symbol', () => {
    const hook = { onAsyncOperationStarted: vi.fn(), version: ASYNC_OPERATION_HOOK_VERSION };
    setAsyncOperationHook(hook);

    expect(ASYNC_OPERATION_HOOK_KEY).toBe(Symbol.for('@mnaoumov/typescript-lib/async-operation-hook'));
    // eslint-disable-next-line obsidianmd/no-global-this -- The hook slot intentionally lives on the realm global.
    expect(castTo<Record<symbol, unknown>>(globalThis)[ASYNC_OPERATION_HOOK_KEY]).toBe(hook);
  });

  it('should share the slot with a second loaded copy of the module', async () => {
    const onAsyncOperationStarted = vi.fn();
    setAsyncOperationHook({ onAsyncOperationStarted, version: ASYNC_OPERATION_HOOK_VERSION });

    vi.resetModules();
    const secondCopy = await import('./async-operation-hook.ts');
    expect(secondCopy.notifyAsyncOperationStarted).not.toBe(notifyAsyncOperationStarted);
    const operation = noopAsync();
    secondCopy.notifyAsyncOperationStarted(operation);

    expect(onAsyncOperationStarted).toHaveBeenCalledWith(operation);
  });
});
