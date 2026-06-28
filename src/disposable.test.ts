import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  AsyncCallbackDisposable,
  CallbackDisposable,
  isAsyncDisposable,
  isDisposable,
  MultipleDisposeBehavior
} from './disposable.ts';
import { noop } from './function.ts';
import { castTo } from './object-utils.ts';

describe('CallbackDisposable', () => {
  it('should execute the callback when disposed', () => {
    const callback = vi.fn();
    const disposable = new CallbackDisposable({ callback });
    disposable[Symbol.dispose]();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should invoke the callback on each dispose by default', () => {
    const callback = vi.fn();
    const disposable = new CallbackDisposable({ callback });
    disposable[Symbol.dispose]();
    disposable[Symbol.dispose]();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should invoke the callback on each dispose when behavior is Invoke', () => {
    const callback = vi.fn();
    const disposable = new CallbackDisposable({
      callback,
      multipleDisposeBehavior: MultipleDisposeBehavior.Invoke
    });
    disposable[Symbol.dispose]();
    disposable[Symbol.dispose]();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should invoke the callback only once when behavior is Ignore', () => {
    const callback = vi.fn();
    const disposable = new CallbackDisposable({
      callback,
      multipleDisposeBehavior: MultipleDisposeBehavior.Ignore
    });
    disposable[Symbol.dispose]();
    disposable[Symbol.dispose]();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should throw on a second dispose when behavior is Throw', () => {
    const callback = vi.fn();
    const disposable = new CallbackDisposable({
      callback,
      multipleDisposeBehavior: MultipleDisposeBehavior.Throw
    });
    disposable[Symbol.dispose]();
    expect(() => {
      disposable[Symbol.dispose]();
    }).toThrow('already been disposed');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should throw on a second dispose with an unknown behavior', () => {
    const callback = vi.fn();
    const disposable = new CallbackDisposable({
      callback,
      multipleDisposeBehavior: castTo<MultipleDisposeBehavior>(-1)
    });
    disposable[Symbol.dispose]();
    expect(() => {
      disposable[Symbol.dispose]();
    }).toThrow();
  });
});

describe('AsyncCallbackDisposable', () => {
  it('should execute the callback when disposed', async () => {
    const callback = vi.fn();
    const disposable = new AsyncCallbackDisposable({ callback });
    await disposable[Symbol.asyncDispose]();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should invoke the callback on each dispose by default', async () => {
    const callback = vi.fn();
    const disposable = new AsyncCallbackDisposable({ callback });
    await disposable[Symbol.asyncDispose]();
    await disposable[Symbol.asyncDispose]();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should invoke the callback on each dispose when behavior is Invoke', async () => {
    const callback = vi.fn();
    const disposable = new AsyncCallbackDisposable({
      callback,
      multipleDisposeBehavior: MultipleDisposeBehavior.Invoke
    });
    await disposable[Symbol.asyncDispose]();
    await disposable[Symbol.asyncDispose]();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should invoke the callback only once when behavior is Ignore', async () => {
    const callback = vi.fn();
    const disposable = new AsyncCallbackDisposable({
      callback,
      multipleDisposeBehavior: MultipleDisposeBehavior.Ignore
    });
    await disposable[Symbol.asyncDispose]();
    await disposable[Symbol.asyncDispose]();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should reject on a second dispose when behavior is Throw', async () => {
    const callback = vi.fn();
    const disposable = new AsyncCallbackDisposable({
      callback,
      multipleDisposeBehavior: MultipleDisposeBehavior.Throw
    });
    await disposable[Symbol.asyncDispose]();
    await expect(disposable[Symbol.asyncDispose]()).rejects.toThrow('already been disposed');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should reject on a second dispose with an unknown behavior', async () => {
    const callback = vi.fn();
    const disposable = new AsyncCallbackDisposable({
      callback,
      multipleDisposeBehavior: castTo<MultipleDisposeBehavior>(-1)
    });
    await disposable[Symbol.asyncDispose]();
    await expect(disposable[Symbol.asyncDispose]()).rejects.toThrow();
  });
});

describe('isDisposable', () => {
  it('should return true for objects with Symbol.dispose', () => {
    const obj = { [Symbol.dispose]: noop };
    expect(isDisposable(obj)).toBe(true);
  });

  it('should return false for objects without Symbol.dispose', () => {
    expect(isDisposable({})).toBe(false);
  });
});

describe('isAsyncDisposable', () => {
  it('should return true for an object with Symbol.asyncDispose', () => {
    const disposable = new AsyncCallbackDisposable({ callback: vi.fn() });
    expect(isAsyncDisposable(disposable)).toBe(true);
  });

  it('should return false for an object without Symbol.asyncDispose', () => {
    expect(isAsyncDisposable({})).toBe(false);
  });
});
