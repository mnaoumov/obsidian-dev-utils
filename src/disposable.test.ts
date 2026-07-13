import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  AsyncCallbackDisposable,
  CallbackDisposable,
  CombineAsyncDisposable,
  CombineDisposable,
  DisposeErrorBehavior,
  DisposeOrder,
  isAsyncDisposable,
  isAsyncDisposableEx,
  isDisposable,
  isDisposableEx,
  MultipleDisposeBehavior,
  toAsyncDisposableEx,
  toDisposableEx
} from './disposable.ts';
import {
  noop,
  noopAsync
} from './function.ts';
import { castTo } from './object-utils.ts';

describe('CallbackDisposable', () => {
  it('should execute the callback when disposed', () => {
    const callback = vi.fn();
    const disposable = new CallbackDisposable({ callback });
    disposable[Symbol.dispose]();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should execute the callback when disposed via the dispose() convenience method', () => {
    const callback = vi.fn();
    const disposable = new CallbackDisposable({ callback });
    disposable.dispose();
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

  it('should execute the callback when disposed via the asyncDispose() convenience method', async () => {
    const callback = vi.fn();
    const disposable = new AsyncCallbackDisposable({ callback });
    await disposable.asyncDispose();
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

describe('toDisposableEx / isDisposableEx', () => {
  it('should wrap a plain Disposable and delegate the dispose() convenience method', () => {
    const dispose = vi.fn();
    const plain: Disposable = { [Symbol.dispose]: dispose };
    expect(isDisposableEx(plain)).toBe(false);

    const disposableEx = toDisposableEx(plain);
    expect(isDisposableEx(disposableEx)).toBe(true);

    disposableEx.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('should delegate the wrapped Symbol.dispose()', () => {
    const dispose = vi.fn();
    const disposableEx = toDisposableEx({ [Symbol.dispose]: dispose });
    disposableEx[Symbol.dispose]();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('should return an already-DisposableEx input unchanged', () => {
    const disposableEx = new CallbackDisposable({ callback: noop });
    expect(toDisposableEx(disposableEx)).toBe(disposableEx);
  });

  it('should return false for a bare object', () => {
    expect(isDisposableEx({})).toBe(false);
  });
});

describe('toAsyncDisposableEx / isAsyncDisposableEx', () => {
  it('should wrap a plain AsyncDisposable and delegate the asyncDispose() convenience method', async () => {
    const asyncDispose = vi.fn(() => noopAsync());
    const plain: AsyncDisposable = { [Symbol.asyncDispose]: asyncDispose };
    expect(isAsyncDisposableEx(plain)).toBe(false);

    const asyncDisposableEx = toAsyncDisposableEx(plain);
    expect(isAsyncDisposableEx(asyncDisposableEx)).toBe(true);

    await asyncDisposableEx.asyncDispose();
    expect(asyncDispose).toHaveBeenCalledTimes(1);
  });

  it('should delegate the wrapped Symbol.asyncDispose()', async () => {
    const asyncDispose = vi.fn(() => noopAsync());
    const asyncDisposableEx = toAsyncDisposableEx({ [Symbol.asyncDispose]: asyncDispose });
    await asyncDisposableEx[Symbol.asyncDispose]();
    expect(asyncDispose).toHaveBeenCalledTimes(1);
  });

  it('should return an already-AsyncDisposableEx input unchanged', () => {
    const asyncDisposableEx = new AsyncCallbackDisposable({ callback: noop });
    expect(toAsyncDisposableEx(asyncDisposableEx)).toBe(asyncDisposableEx);
  });

  it('should return false for a bare object', () => {
    expect(isAsyncDisposableEx({})).toBe(false);
  });
});

describe('CombineDisposable', () => {
  it('should dispose all children via the dispose() convenience method', () => {
    const a = vi.fn();
    const b = vi.fn();
    const combined = new CombineDisposable({ disposables: [{ [Symbol.dispose]: a }, { [Symbol.dispose]: b }] });
    combined.dispose();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('should dispose children in LIFO order by default', () => {
    const order: string[] = [];
    const combined = new CombineDisposable({
      disposables: [
        { [Symbol.dispose]: (): number => order.push('a') },
        { [Symbol.dispose]: (): number => order.push('b') }
      ]
    });
    combined[Symbol.dispose]();
    expect(order).toEqual(['b', 'a']);
  });

  it('should dispose children in FIFO order when configured', () => {
    const order: string[] = [];
    const combined = new CombineDisposable({
      disposables: [
        { [Symbol.dispose]: (): number => order.push('a') },
        { [Symbol.dispose]: (): number => order.push('b') }
      ],
      disposeOrder: DisposeOrder.Fifo
    });
    combined[Symbol.dispose]();
    expect(order).toEqual(['a', 'b']);
  });

  it('should re-dispose children by default', () => {
    const a = vi.fn();
    const combined = new CombineDisposable({ disposables: [{ [Symbol.dispose]: a }] });
    combined[Symbol.dispose]();
    combined[Symbol.dispose]();
    expect(a).toHaveBeenCalledTimes(2);
  });

  it('should dispose children only once when behavior is Ignore', () => {
    const a = vi.fn();
    const combined = new CombineDisposable({
      disposables: [{ [Symbol.dispose]: a }],
      multipleDisposeBehavior: MultipleDisposeBehavior.Ignore
    });
    combined[Symbol.dispose]();
    combined[Symbol.dispose]();
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('should throw on a second dispose when behavior is Throw', () => {
    const combined = new CombineDisposable({
      disposables: [],
      multipleDisposeBehavior: MultipleDisposeBehavior.Throw
    });
    combined[Symbol.dispose]();
    expect(() => {
      combined[Symbol.dispose]();
    }).toThrow('already been disposed');
  });

  it('should throw on a second dispose with an unknown behavior', () => {
    const combined = new CombineDisposable({
      disposables: [],
      multipleDisposeBehavior: castTo<MultipleDisposeBehavior>(-1)
    });
    combined[Symbol.dispose]();
    expect(() => {
      combined[Symbol.dispose]();
    }).toThrow();
  });

  it('should throw with an unknown dispose order', () => {
    const combined = new CombineDisposable({
      disposables: [{ [Symbol.dispose]: noop }],
      disposeOrder: castTo<DisposeOrder>(-1)
    });
    expect(() => {
      combined[Symbol.dispose]();
    }).toThrow();
  });

  it('should dispose every child and aggregate the errors by default', () => {
    const a = vi.fn(() => {
      throw new Error('a failed');
    });
    const b = vi.fn();
    const c = vi.fn(() => {
      throw new Error('c failed');
    });
    const combined = new CombineDisposable({
      disposables: [{ [Symbol.dispose]: a }, { [Symbol.dispose]: b }, { [Symbol.dispose]: c }],
      disposeOrder: DisposeOrder.Fifo
    });

    let caught: unknown;
    try {
      combined[Symbol.dispose]();
    } catch (error) {
      caught = error;
    }

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
    expect(caught).toBeInstanceOf(AggregateError);
    expect(castTo<AggregateError>(caught).errors).toHaveLength(2);
  });

  it('should fail fast on the first child error when configured', () => {
    const a = vi.fn(() => {
      throw new Error('a failed');
    });
    const b = vi.fn();
    const combined = new CombineDisposable({
      disposables: [{ [Symbol.dispose]: a }, { [Symbol.dispose]: b }],
      disposeOrder: DisposeOrder.Fifo,
      errorBehavior: DisposeErrorBehavior.FailFast
    });

    expect(() => {
      combined[Symbol.dispose]();
    }).toThrow('a failed');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });
});

describe('CombineAsyncDisposable', () => {
  it('should dispose all children via the asyncDispose() convenience method', async () => {
    const a = vi.fn(() => noopAsync());
    const b = vi.fn(() => noopAsync());
    const combined = new CombineAsyncDisposable({ asyncDisposables: [{ [Symbol.asyncDispose]: a }, { [Symbol.asyncDispose]: b }] });
    await combined.asyncDispose();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('should dispose children in LIFO order by default', async () => {
    const order: string[] = [];
    const combined = new CombineAsyncDisposable({
      asyncDisposables: [
        {
          [Symbol.asyncDispose]: (): Promise<void> => {
            order.push('a');
            return noopAsync();
          }
        },
        {
          [Symbol.asyncDispose]: (): Promise<void> => {
            order.push('b');
            return noopAsync();
          }
        }
      ]
    });
    await combined[Symbol.asyncDispose]();
    expect(order).toEqual(['b', 'a']);
  });

  it('should dispose children in FIFO order when configured', async () => {
    const order: string[] = [];
    const combined = new CombineAsyncDisposable({
      asyncDisposables: [
        {
          [Symbol.asyncDispose]: (): Promise<void> => {
            order.push('a');
            return noopAsync();
          }
        },
        {
          [Symbol.asyncDispose]: (): Promise<void> => {
            order.push('b');
            return noopAsync();
          }
        }
      ],
      disposeOrder: DisposeOrder.Fifo
    });
    await combined[Symbol.asyncDispose]();
    expect(order).toEqual(['a', 'b']);
  });

  it('should re-dispose children by default', async () => {
    const a = vi.fn(() => noopAsync());
    const combined = new CombineAsyncDisposable({ asyncDisposables: [{ [Symbol.asyncDispose]: a }] });
    await combined[Symbol.asyncDispose]();
    await combined[Symbol.asyncDispose]();
    expect(a).toHaveBeenCalledTimes(2);
  });

  it('should dispose children only once when behavior is Ignore', async () => {
    const a = vi.fn(() => noopAsync());
    const combined = new CombineAsyncDisposable({
      asyncDisposables: [{ [Symbol.asyncDispose]: a }],
      multipleDisposeBehavior: MultipleDisposeBehavior.Ignore
    });
    await combined[Symbol.asyncDispose]();
    await combined[Symbol.asyncDispose]();
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('should reject on a second dispose when behavior is Throw', async () => {
    const combined = new CombineAsyncDisposable({
      asyncDisposables: [],
      multipleDisposeBehavior: MultipleDisposeBehavior.Throw
    });
    await combined[Symbol.asyncDispose]();
    await expect(combined[Symbol.asyncDispose]()).rejects.toThrow('already been disposed');
  });

  it('should reject on a second dispose with an unknown behavior', async () => {
    const combined = new CombineAsyncDisposable({
      asyncDisposables: [],
      multipleDisposeBehavior: castTo<MultipleDisposeBehavior>(-1)
    });
    await combined[Symbol.asyncDispose]();
    await expect(combined[Symbol.asyncDispose]()).rejects.toThrow();
  });

  it('should reject with an unknown dispose order', async () => {
    const combined = new CombineAsyncDisposable({
      asyncDisposables: [{ [Symbol.asyncDispose]: (): Promise<void> => noopAsync() }],
      disposeOrder: castTo<DisposeOrder>(-1)
    });
    await expect(combined[Symbol.asyncDispose]()).rejects.toThrow();
  });

  it('should dispose every child and aggregate the errors by default', async () => {
    const a = vi.fn(() => Promise.reject(new Error('a failed')));
    const b = vi.fn(() => noopAsync());
    const c = vi.fn(() => Promise.reject(new Error('c failed')));
    const combined = new CombineAsyncDisposable({
      asyncDisposables: [{ [Symbol.asyncDispose]: a }, { [Symbol.asyncDispose]: b }, { [Symbol.asyncDispose]: c }],
      disposeOrder: DisposeOrder.Fifo
    });

    let caught: unknown;
    try {
      await combined[Symbol.asyncDispose]();
    } catch (error) {
      caught = error;
    }

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
    expect(caught).toBeInstanceOf(AggregateError);
    expect(castTo<AggregateError>(caught).errors).toHaveLength(2);
  });

  it('should fail fast on the first child error when configured', async () => {
    const a = vi.fn(() => Promise.reject(new Error('a failed')));
    const b = vi.fn(() => noopAsync());
    const combined = new CombineAsyncDisposable({
      asyncDisposables: [{ [Symbol.asyncDispose]: a }, { [Symbol.asyncDispose]: b }],
      disposeOrder: DisposeOrder.Fifo,
      errorBehavior: DisposeErrorBehavior.FailFast
    });

    await expect(combined[Symbol.asyncDispose]()).rejects.toThrow('a failed');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });
});
