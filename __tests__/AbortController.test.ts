import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  abortSignalAny,
  abortSignalNever,
  abortSignalTimeout,
  INFINITE_TIMEOUT,
  onAbort,
  waitForAbort
} from '../src/AbortController.ts';
import { castTo } from '../src/ObjectUtils.ts';
import { assertNonNullable } from '../src/TypeGuards.ts';

type WindowEx = typeof globalThis & Window;

describe('INFINITE_TIMEOUT', () => {
  it('should equal Number.POSITIVE_INFINITY', () => {
    expect(INFINITE_TIMEOUT).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('abortSignalNever', () => {
  it('should return an AbortSignal instance', () => {
    const signal = abortSignalNever();
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('should return a signal that is not aborted', () => {
    const signal = abortSignalNever();
    expect(signal.aborted).toBe(false);
  });

  it('should return a new signal each time', () => {
    const signal1 = abortSignalNever();
    const signal2 = abortSignalNever();
    expect(signal1).not.toBe(signal2);
  });
});

describe('abortSignalTimeout', () => {
  it('should return an AbortSignal instance for INFINITE_TIMEOUT', () => {
    const signal = abortSignalTimeout(INFINITE_TIMEOUT);
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('should return a non-aborted signal for INFINITE_TIMEOUT', () => {
    const signal = abortSignalTimeout(INFINITE_TIMEOUT);
    expect(signal.aborted).toBe(false);
  });

  it('should not be aborted immediately for a finite timeout', () => {
    const signal = abortSignalTimeout(50);
    expect(signal.aborted).toBe(false);
  });

  it('should abort after the specified timeout elapses', async () => {
    const signal = abortSignalTimeout(50);
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(signal.aborted).toBe(true);
  });

  it('should not abort before the timeout elapses', () => {
    const signal = abortSignalTimeout(5000);
    expect(signal.aborted).toBe(false);
  });

  describe('fallback path (when AbortSignal.timeout is unavailable)', () => {
    let originalTimeout: typeof AbortSignal.timeout;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- No bind.
      originalTimeout = AbortSignal.timeout;
      AbortSignal.timeout = castTo<typeof AbortSignal.timeout>(undefined);
    });

    afterEach(() => {
      AbortSignal.timeout = originalTimeout;
    });

    it('should return an AbortSignal instance for INFINITE_TIMEOUT (fallback)', () => {
      const signal = abortSignalTimeout(INFINITE_TIMEOUT);
      expect(signal).toBeInstanceOf(AbortSignal);
    });

    it('should return a non-aborted signal for INFINITE_TIMEOUT (fallback)', () => {
      const signal = abortSignalTimeout(INFINITE_TIMEOUT);
      expect(signal.aborted).toBe(false);
    });

    it('should not be aborted before timeout elapses (fallback)', () => {
      const originalWindow = globalThis.window;
      globalThis.window = globalThis as WindowEx;

      vi.useFakeTimers();
      try {
        const signal = abortSignalTimeout(100);
        expect(signal.aborted).toBe(false);
      } finally {
        vi.useRealTimers();
        restoreOriginalWindow(originalWindow);
      }
    });

    it('should abort after the specified timeout using window.setTimeout (fallback)', () => {
      const originalWindow = globalThis.window;
      globalThis.window = globalThis as WindowEx;

      vi.useFakeTimers();
      try {
        const signal = abortSignalTimeout(100);
        vi.advanceTimersByTime(100);
        expect(signal.aborted).toBe(true);
      } finally {
        vi.useRealTimers();
        restoreOriginalWindow(originalWindow);
      }
    });

    it('should set reason to an Error instance after timeout (fallback)', () => {
      const originalWindow = globalThis.window;
      globalThis.window = globalThis as WindowEx;

      vi.useFakeTimers();
      try {
        const signal = abortSignalTimeout(100);
        vi.advanceTimersByTime(100);
        expect(signal.reason).toBeInstanceOf(Error);
      } finally {
        vi.useRealTimers();
        restoreOriginalWindow(originalWindow);
      }
    });

    it('should set the correct timeout message after timeout (fallback)', () => {
      const originalWindow = globalThis.window;
      globalThis.window = globalThis as WindowEx;

      vi.useFakeTimers();
      try {
        const signal = abortSignalTimeout(100);
        vi.advanceTimersByTime(100);
        expect((signal.reason as Error).message).toBe('Timed out in 100 milliseconds');
      } finally {
        vi.useRealTimers();
        restoreOriginalWindow(originalWindow);
      }
    });

    it('should not abort before the timeout elapses (fallback)', () => {
      const originalWindow = globalThis.window;
      globalThis.window = globalThis as WindowEx;

      vi.useFakeTimers();
      try {
        const signal = abortSignalTimeout(5000);
        vi.advanceTimersByTime(4999);
        expect(signal.aborted).toBe(false);
      } finally {
        vi.useRealTimers();
        restoreOriginalWindow(originalWindow);
      }
    });
  });
});

describe('abortSignalAny', () => {
  it('should return an AbortSignal instance when called with no arguments', () => {
    const signal = abortSignalAny();
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('should return a non-aborted signal when called with no arguments', () => {
    const signal = abortSignalAny();
    expect(signal.aborted).toBe(false);
  });

  it('should return an AbortSignal instance when filtering out undefined values', () => {
    const signal = abortSignalAny(undefined, undefined);
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('should return a non-aborted signal when filtering out undefined values', () => {
    const signal = abortSignalAny(undefined, undefined);
    expect(signal.aborted).toBe(false);
  });

  it('should return an already-aborted signal if any input is already aborted', () => {
    const controller = new AbortController();
    const reason = new Error('already aborted');
    controller.abort(reason);

    const neverSignal = abortSignalNever();
    const signal = abortSignalAny(neverSignal, controller.signal);

    expect(signal.aborted).toBe(true);
  });

  it('should carry the reason from the already-aborted input signal', () => {
    const controller = new AbortController();
    const reason = new Error('already aborted');
    controller.abort(reason);

    const neverSignal = abortSignalNever();
    const signal = abortSignalAny(neverSignal, controller.signal);

    expect(signal.reason).toBe(reason);
  });

  it('should not be aborted initially when all input signals are active', () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    const signal = abortSignalAny(controller1.signal, controller2.signal);
    expect(signal.aborted).toBe(false);
  });

  it('should abort when one of the input signals aborts', () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    const signal = abortSignalAny(controller1.signal, controller2.signal);
    const reason = new Error('aborted');
    controller1.abort(reason);

    expect(signal.aborted).toBe(true);
  });

  it('should carry the reason from the signal that aborted', () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    const signal = abortSignalAny(controller1.signal, controller2.signal);
    const reason = new Error('aborted');
    controller1.abort(reason);

    expect(signal.reason).toBe(reason);
  });

  it('should work with a single signal', () => {
    const controller = new AbortController();
    const signal = abortSignalAny(controller.signal);

    // Should abort when the input aborts
    const reason = new Error('single abort');
    controller.abort(reason);
    expect(signal.aborted).toBe(true);
  });

  it('should not be aborted initially with mix of undefined and valid signals', () => {
    const controller = new AbortController();
    const signal = abortSignalAny(undefined, controller.signal, undefined);

    expect(signal.aborted).toBe(false);
  });

  it('should abort with mix of undefined and valid signals when the valid signal aborts', () => {
    const controller = new AbortController();
    const signal = abortSignalAny(undefined, controller.signal, undefined);

    controller.abort(new Error('mixed'));
    expect(signal.aborted).toBe(true);
  });

  describe('fallback path (when AbortSignal.any is unavailable)', () => {
    let originalAny: typeof AbortSignal.any;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- No bind.
      originalAny = AbortSignal.any;
      AbortSignal.any = castTo<typeof AbortSignal.any>(undefined);
    });

    afterEach(() => {
      AbortSignal.any = originalAny;
    });

    it('should return an AbortSignal instance when called with no arguments (fallback)', () => {
      const signal = abortSignalAny();
      expect(signal).toBeInstanceOf(AbortSignal);
    });

    it('should return a non-aborted signal when called with no arguments (fallback)', () => {
      const signal = abortSignalAny();
      expect(signal.aborted).toBe(false);
    });

    it('should return the single signal directly when only one signal is provided (fallback)', () => {
      const controller = new AbortController();
      const signal = abortSignalAny(controller.signal);

      expect(signal).toBe(controller.signal);
    });

    it('should not be aborted when the single signal is active (fallback)', () => {
      const controller = new AbortController();
      const signal = abortSignalAny(controller.signal);

      expect(signal.aborted).toBe(false);
    });

    it('should return an already-aborted signal if any input is already aborted (fallback)', () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      const reason = new Error('already aborted fallback');
      controller1.abort(reason);

      const signal = abortSignalAny(controller2.signal, controller1.signal);

      expect(signal.aborted).toBe(true);
    });

    it('should carry the reason from the already-aborted input signal (fallback)', () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      const reason = new Error('already aborted fallback');
      controller1.abort(reason);

      const signal = abortSignalAny(controller2.signal, controller1.signal);

      expect(signal.reason).toBe(reason);
    });

    it('should not be aborted initially when all input signals are active (fallback)', () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      const signal = abortSignalAny(controller1.signal, controller2.signal);
      expect(signal.aborted).toBe(false);
    });

    it('should abort composite signal when one of the input signals aborts (fallback)', () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      const signal = abortSignalAny(controller1.signal, controller2.signal);
      const reason = new Error('fallback abort');
      controller1.abort(reason);

      expect(signal.aborted).toBe(true);
    });

    it('should carry the reason from the signal that aborted (fallback)', () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      const signal = abortSignalAny(controller1.signal, controller2.signal);
      const reason = new Error('fallback abort');
      controller1.abort(reason);

      expect(signal.reason).toBe(reason);
    });

    it('should abort with the first reason after one signal aborts (fallback)', () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      const controller3 = new AbortController();

      const signal = abortSignalAny(controller1.signal, controller2.signal, controller3.signal);

      const reason = new Error('first abort');
      controller2.abort(reason);

      expect(signal.aborted).toBe(true);
    });

    it('should retain the first abort reason even after a second signal aborts (fallback)', () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      const controller3 = new AbortController();

      const signal = abortSignalAny(controller1.signal, controller2.signal, controller3.signal);

      const reason = new Error('first abort');
      controller2.abort(reason);

      // The second abort should not cause issues (listeners already removed)
      controller1.abort(new Error('second abort'));
      // The signal's reason should still be the first one
      expect(signal.reason).toBe(reason);
    });

    it('should return an AbortSignal instance when filtering out undefined values (fallback)', () => {
      const signal = abortSignalAny(undefined, undefined);
      expect(signal).toBeInstanceOf(AbortSignal);
    });

    it('should return a non-aborted signal when filtering out undefined values (fallback)', () => {
      const signal = abortSignalAny(undefined, undefined);
      expect(signal.aborted).toBe(false);
    });

    it('should handle mix of undefined and valid signals in fallback path', () => {
      const controller = new AbortController();
      const signal = abortSignalAny(undefined, controller.signal, undefined);

      // After filtering, only one signal remains, so it's returned directly
      expect(signal).toBe(controller.signal);
    });
  });
});

describe('onAbort', () => {
  it('should call callback immediately if signal is already aborted', () => {
    const controller = new AbortController();
    const reason = new Error('already done');
    controller.abort(reason);

    const callback = vi.fn();
    onAbort(controller.signal, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(controller.signal);
  });

  it('should allow calling remover after immediate callback invocation without error', () => {
    const controller = new AbortController();
    controller.abort(new Error('already done'));

    const callback = vi.fn();
    const remover = onAbort(controller.signal, callback);

    // Remover should be a noop (no error when called)
    expect(() => {
      remover();
    }).not.toThrow();
  });

  it('should not call callback before signal aborts', () => {
    const controller = new AbortController();
    const callback = vi.fn();

    onAbort(controller.signal, callback);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should call callback when signal aborts', () => {
    const controller = new AbortController();
    const callback = vi.fn();

    onAbort(controller.signal, callback);
    controller.abort(new Error('later'));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should pass an AbortSignal instance to the callback on abort', () => {
    const controller = new AbortController();
    const callback = vi.fn();

    onAbort(controller.signal, callback);
    controller.abort(new Error('test'));

    const firstCall = callback.mock.calls[0];
    assertNonNullable(firstCall);
    const receivedSignal = firstCall[0] as AbortSignal;
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
  });

  it('should pass an aborted signal to the callback on abort', () => {
    const controller = new AbortController();
    const callback = vi.fn();

    onAbort(controller.signal, callback);
    controller.abort(new Error('test'));

    const firstCall = callback.mock.calls[0];
    assertNonNullable(firstCall);
    const receivedSignal = firstCall[0] as AbortSignal;
    expect(receivedSignal.aborted).toBe(true);
  });

  it('should not call callback after remover is invoked', () => {
    const controller = new AbortController();
    const callback = vi.fn();

    const remover = onAbort(controller.signal, callback);
    remover();

    controller.abort(new Error('should not fire'));
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('waitForAbort', () => {
  it('should resolve with the abort reason when signal aborts', async () => {
    const controller = new AbortController();
    const reason = new Error('done');

    const promise = waitForAbort(controller.signal);
    controller.abort(reason);

    const result = await promise;
    expect(result).toBe(reason);
  });

  it('should resolve immediately if signal is already aborted', async () => {
    const controller = new AbortController();
    const reason = new Error('pre-aborted');
    controller.abort(reason);

    const result = await waitForAbort(controller.signal);
    expect(result).toBe(reason);
  });

  it('should reject with the abort reason when shouldRejectOnAbort is true', async () => {
    const controller = new AbortController();
    const reason = new Error('rejected');

    const promise = waitForAbort(controller.signal, true);
    controller.abort(reason);

    await expect(promise).rejects.toBe(reason);
  });

  it('should reject immediately if signal is already aborted and shouldRejectOnAbort is true', async () => {
    const controller = new AbortController();
    const reason = new Error('pre-rejected');
    controller.abort(reason);

    await expect(waitForAbort(controller.signal, true)).rejects.toBe(reason);
  });
});

function restoreOriginalWindow(originalWindow?: WindowEx): void {
  if (originalWindow === undefined) {
    delete (globalThis as Partial<typeof globalThis>).window;
  } else {
    globalThis.window = originalWindow;
  }
}
