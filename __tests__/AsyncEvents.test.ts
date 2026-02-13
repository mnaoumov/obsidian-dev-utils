import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { AsyncEvents } from '../src/AsyncEvents.ts';
import { noopAsync } from '../src/Function.ts';
import { assertNotNullable } from './TestHelpers.ts';

describe('AsyncEvents', () => {
  let events: AsyncEvents;
  let setTimeoutSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    events = new AsyncEvents();
    setTimeoutSpy = vi.fn();
    vi.stubGlobal('window', { setTimeout: setTimeoutSpy });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('on / trigger', () => {
    it('should register and fire callback with correct args', () => {
      const callback = vi.fn();
      events.on<[string, number]>('test', callback);
      events.trigger<[string, number]>('test', 'hello', 42);
      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith('hello', 42);
    });

    it('should call multiple listeners in registration order', () => {
      const order: number[] = [];
      events.on('test', () => {
        order.push(1);
      });
      events.on('test', () => {
        order.push(2);
      });
      events.on('test', () => {
        order.push(3);
      });
      events.trigger('test');
      expect(order).toEqual([1, 2, 3]);
    });

    it('should not fire listeners for a different event name', () => {
      const callback = vi.fn();
      events.on('event-a', callback);
      events.trigger('event-b');
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle triggering an event with no listeners', () => {
      expect(() => {
        events.trigger('nonexistent');
      }).not.toThrow();
    });
  });

  describe('off', () => {
    it('should not call the removed listener after off', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      events.on('test', callback1);
      events.on('test', callback2);
      events.off('test', callback1);
      events.trigger('test');
      expect(callback1).not.toHaveBeenCalled();
    });

    it('should still call remaining listeners after off removes another', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      events.on('test', callback1);
      events.on('test', callback2);
      events.off('test', callback1);
      events.trigger('test');
      expect(callback2).toHaveBeenCalledOnce();
    });

    it('should do nothing when removing a listener for nonexistent event', () => {
      const callback = vi.fn();
      expect(() => {
        events.off('nonexistent', callback);
      }).not.toThrow();
    });

    it('should do nothing when removing a callback that was never registered', () => {
      const registered = vi.fn();
      const notRegistered = vi.fn();
      events.on('test', registered);
      events.off('test', notRegistered);
      events.trigger('test');
      expect(registered).toHaveBeenCalledOnce();
    });

    it('should clean up the event entry when the last handler is removed', () => {
      const callback = vi.fn();
      events.on('cleanup-test', callback);
      events.off('cleanup-test', callback);
      events.trigger('cleanup-test');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('offref', () => {
    it('should remove a listener by event reference', () => {
      const callback = vi.fn();
      const ref = events.on('test', callback);
      events.offref(ref);
      events.trigger('test');
      expect(callback).not.toHaveBeenCalled();
    });

    it('should not remove other listeners when removing a specific ref', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const ref1 = events.on('test', callback1);
      events.on('test', callback2);
      events.offref(ref1);
      events.trigger('test');
      expect(callback1).not.toHaveBeenCalled();
    });

    it('should still call remaining listeners after removing a specific ref', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const ref1 = events.on('test', callback1);
      events.on('test', callback2);
      events.offref(ref1);
      events.trigger('test');
      expect(callback2).toHaveBeenCalledOnce();
    });

    it('should do nothing when removing a ref for nonexistent event', () => {
      const ref = events.on('test', vi.fn());
      events.offref(ref);
      // Removing again should not throw
      expect(() => {
        events.offref(ref);
      }).not.toThrow();
    });
  });

  describe('once', () => {
    it('should fire the callback only once', () => {
      const callback = vi.fn();
      events.once('test', callback);
      events.trigger('test');
      events.trigger('test');
      events.trigger('test');
      expect(callback).toHaveBeenCalledOnce();
    });

    it('should pass correct arguments to the once callback', () => {
      const callback = vi.fn();
      events.once<[string, number]>('test', callback);
      events.trigger<[string, number]>('test', 'arg1', 99);
      expect(callback).toHaveBeenCalledWith('arg1', 99);
    });

    it('should return a ref that can be used to cancel before firing', () => {
      const callback = vi.fn();
      const ref = events.once('test', callback);
      events.offref(ref);
      events.trigger('test');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('on with thisArg', () => {
    it('should pass the correct this context to the callback', () => {
      const context = { value: 42 };
      let receivedThis: unknown;
      events.on('test', function fn(this: unknown): void {
        // eslint-disable-next-line @typescript-eslint/no-this-alias, consistent-this -- Need to capture `this` for testing.
        receivedThis = this;
      }, context);
      events.trigger('test');
      expect(receivedThis).toBe(context);
    });

    it('should pass the correct this context for once callbacks', () => {
      const context = { id: 'once-context' };
      let receivedThis: unknown;
      events.once('test', function fn(this: unknown): void {
        // eslint-disable-next-line @typescript-eslint/no-this-alias, consistent-this -- Need to capture `this` for testing.
        receivedThis = this;
      }, context);
      events.trigger('test');
      expect(receivedThis).toBe(context);
    });
  });

  describe('trigger error handling', () => {
    it('should catch errors and defer via window.setTimeout', () => {
      const error = new Error('callback error');
      events.on('test', () => {
        throw error;
      });
      events.trigger('test');
      expect(setTimeoutSpy).toHaveBeenCalledOnce();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
    });

    it('should rethrow the error from the deferred function', () => {
      const error = new Error('callback error');
      events.on('test', () => {
        throw error;
      });
      events.trigger('test');

      const firstCall = setTimeoutSpy.mock.calls[0];
      assertNotNullable(firstCall);
      const deferredFn = firstCall[0] as () => void;
      expect(() => {
        deferredFn();
      }).toThrow(error);
    });

    it('should call all listeners even if one throws', () => {
      const callback1 = vi.fn(() => {
        throw new Error('oops');
      });
      const callback2 = vi.fn();
      events.on('test', callback1);
      events.on('test', callback2);
      events.trigger('test');
      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).toHaveBeenCalledOnce();
    });

    it('should defer exactly one error when one listener throws', () => {
      vi.fn(() => {
        throw new Error('oops');
      });
      const callback1 = vi.fn(() => {
        throw new Error('oops');
      });
      const callback2 = vi.fn();
      events.on('test', callback1);
      events.on('test', callback2);
      events.trigger('test');
      expect(setTimeoutSpy).toHaveBeenCalledOnce();
    });
  });

  describe('triggerAsync', () => {
    it('should fire async callbacks in order', async () => {
      const order: number[] = [];
      events.on('test', async () => {
        await Promise.resolve();
        order.push(1);
      });
      events.on('test', async () => {
        await Promise.resolve();
        order.push(2);
      });
      await events.triggerAsync('test');
      expect(order).toEqual([1, 2]);
    });

    it('should pass arguments to async callbacks', async () => {
      const callback = vi.fn(noopAsync);
      events.on<[string]>('test', callback);
      await events.triggerAsync<[string]>('test', 'async-arg');
      expect(callback).toHaveBeenCalledWith('async-arg');
    });

    it('should catch errors from async callbacks and defer via window.setTimeout', async () => {
      const error = new Error('async error');
      events.on('test', async () => {
        throw error;
      });
      await events.triggerAsync('test');
      expect(setTimeoutSpy).toHaveBeenCalledOnce();
    });

    it('should rethrow the async error from the deferred function', async () => {
      const error = new Error('async error');
      events.on('test', async () => {
        throw error;
      });
      await events.triggerAsync('test');
      const firstCall = setTimeoutSpy.mock.calls[0];
      assertNotNullable(firstCall);
      const deferredFn = firstCall[0] as () => void;
      expect(() => {
        deferredFn();
      }).toThrow(error);
    });

    it('should continue calling remaining async listeners even if one throws', async () => {
      const callback1 = vi.fn(async () => {
        throw new Error('oops');
      });
      const callback2 = vi.fn(noopAsync);
      events.on('test', callback1);
      events.on('test', callback2);
      await events.triggerAsync('test');
      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).toHaveBeenCalledOnce();
    });

    it('should handle triggering async with no listeners', async () => {
      await expect(events.triggerAsync('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('tryTrigger', () => {
    it('should call the callback from the event ref with correct args', () => {
      const callback = vi.fn();
      const ref = events.on<[number, string]>('test', callback);
      events.tryTrigger(ref, [10, 'hello']);
      expect(callback).toHaveBeenCalledWith(10, 'hello');
    });

    it('should apply thisArg from the event ref', () => {
      const context = { name: 'ctx' };
      let receivedThis: unknown;
      const ref = events.on('test', function fn(this: unknown): void {
        // eslint-disable-next-line @typescript-eslint/no-this-alias, consistent-this -- Need to capture `this` for testing.
        receivedThis = this;
      }, context);
      events.tryTrigger(ref, []);
      expect(receivedThis).toBe(context);
    });

    it('should catch errors and defer via window.setTimeout', () => {
      const error = new Error('try error');
      const ref = events.on('test', () => {
        throw error;
      });
      events.tryTrigger(ref, []);
      expect(setTimeoutSpy).toHaveBeenCalledOnce();
    });

    it('should rethrow the error from the deferred function in tryTrigger', () => {
      const error = new Error('try error');
      const ref = events.on('test', () => {
        throw error;
      });
      events.tryTrigger(ref, []);
      const firstCall = setTimeoutSpy.mock.calls[0];
      assertNotNullable(firstCall);
      const deferredFn = firstCall[0] as () => void;
      expect(() => {
        deferredFn();
      }).toThrow(error);
    });
  });

  describe('tryTriggerAsync', () => {
    it('should call the async callback from the event ref with correct args', async () => {
      const callback = vi.fn(noopAsync);
      const ref = events.on<[string]>('test', callback);
      await events.tryTriggerAsync(ref, ['async-arg']);
      expect(callback).toHaveBeenCalledWith('async-arg');
    });

    it('should apply thisArg from the event ref', async () => {
      const context = { name: 'async-ctx' };
      let receivedThis: unknown;
      const ref = events.on('test', async function fn(this: unknown): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-this-alias, consistent-this -- Need to capture `this` for testing.
        receivedThis = this;
      }, context);
      await events.tryTriggerAsync(ref, []);
      expect(receivedThis).toBe(context);
    });

    it('should catch async errors and defer via window.setTimeout', async () => {
      const error = new Error('async try error');
      const ref = events.on('test', async () => {
        throw error;
      });
      await events.tryTriggerAsync(ref, []);
      expect(setTimeoutSpy).toHaveBeenCalledOnce();
    });

    it('should rethrow the async error from the deferred function in tryTriggerAsync', async () => {
      const error = new Error('async try error');
      const ref = events.on('test', async () => {
        throw error;
      });
      await events.tryTriggerAsync(ref, []);
      const firstCall = setTimeoutSpy.mock.calls[0];
      assertNotNullable(firstCall);
      const deferredFn = firstCall[0] as () => void;
      expect(() => {
        deferredFn();
      }).toThrow(error);
    });
  });

  describe('event ref structure', () => {
    it('should have asyncEvents pointing to the events instance', () => {
      const callback = vi.fn();
      const ref = events.on('my-event', callback, 'myThis');
      expect(ref.asyncEvents).toBe(events);
    });

    it('should have callback pointing to the registered function', () => {
      const callback = vi.fn();
      const ref = events.on('my-event', callback, 'myThis');
      expect(ref.callback).toBe(callback);
    });

    it('should have name matching the event name', () => {
      const callback = vi.fn();
      const ref = events.on('my-event', callback, 'myThis');
      expect(ref.name).toBe('my-event');
    });

    it('should have thisArg matching the provided context', () => {
      const callback = vi.fn();
      const ref = events.on('my-event', callback, 'myThis');
      expect(ref.thisArg).toBe('myThis');
    });

    it('should have undefined thisArg when not provided', () => {
      const ref = events.on('test', vi.fn());
      expect(ref.thisArg).toBeUndefined();
    });
  });
});
