import type { Promisable } from 'type-fest';

import { filterInPlace } from './Array.ts';

/**
 * Async event reference.
 */
export interface AsyncEventRef {
  /**
   * The event emitter.
   */
  asyncEvents: AsyncEvents;

  /**
   * The callback to call when the event is triggered.
   */
  callback: (...args: unknown[]) => Promisable<unknown>;

  /**
   * The name of the event.
   */
  name: string;

  /**
   * The context passed as `this` to the `callback`.
   */
  thisArg: unknown;
}

/**
 * Async event emitter implementation
 */
export class AsyncEvents {
  private eventRefsMap = new Map<string, AsyncEventRef[]>();

  /**
   * Remove an event listener.
   *
   * @param name - The name of the event.
   * @param callback - The callback to remove.
   *
   * @example
   * ```ts
   * events.off('my-event', myListener);
   * ```
   *
   * @public
   */
  public off(name: string, callback: (...args: unknown[]) => Promisable<unknown>): void {
    const eventRefs = this.eventRefsMap.get(name);
    if (!eventRefs) {
      return;
    }

    filterInPlace(eventRefs, (eventRef) => eventRef.callback !== callback);
    if (eventRefs.length === 0) {
      this.eventRefsMap.delete(name);
    }
  }

  /**
   * Remove an event listener by reference.
   *
   * @param eventRef - The reference to the event listener.
   *
   * @example
   * ```ts
   * events.offref(myRef);
   * ```
   *
   * @public
   */
  public offref(eventRef: AsyncEventRef): void {
    const eventRefs = this.eventRefsMap.get(eventRef.name);
    if (!eventRefs) {
      return;
    }

    filterInPlace(eventRefs, (storedEventRef) => storedEventRef !== eventRef);
    if (eventRefs.length === 0) {
      this.eventRefsMap.delete(eventRef.name);
    }
  }

  /**
   * Add an event listener.
   *
   * @param name - The name of the event.
   * @param callback - The callback to call when the event is triggered.
   * @param thisArg - The context passed as `this` to the `callback`.
   * @returns A reference to the event listener.
   *
   * @example
   * ```ts
   * events.on('my-event', async (arg1, arg2) => {
   *     await sleep(100);
   *     console.log(arg1, arg2);
   * });
   * ```
   *
   * @public
   */
  public on(name: string, callback: (...args: unknown[]) => Promisable<void>, thisArg?: unknown): AsyncEventRef {
    let eventRefs = this.eventRefsMap.get(name);
    if (!eventRefs) {
      eventRefs = [];
      this.eventRefsMap.set(name, eventRefs);
    }

    const eventRef: AsyncEventRef = {
      asyncEvents: this,
      callback,
      name,
      thisArg
    };
    eventRefs.push(eventRef);
    return eventRef;
  }

  /**
   * Add an event listener that will be triggered only once.
   *
   * @param name - The name of the event.
   * @param callback - The callback to call when the event is triggered.
   * @param thisArg - The context passed as `this` to the `callback`.
   * @returns A reference to the event listener.
   *
   * @example
   * ```ts
   * events.once('my-event', async (arg1, arg2) => {
   *     await sleep(100);
   *     console.log(arg1, arg2);
   * });
   * ```
   *
   * @public
   */
  public once(name: string, callback: (...args: unknown[]) => Promisable<void>, thisArg?: unknown): AsyncEventRef {
    const originalEventRef = this.on(name, callback, thisArg);
    const cleanupEventRef = this.on(name, () => {
      this.offref(originalEventRef);
      this.offref(cleanupEventRef);
    });
    return originalEventRef;
  }

  /**
   * Trigger an event, executing all the listeners in order even if some of them throw an error.
   *
   * @param name - The name of the event.
   * @param args - The data to pass to the event listeners.
   *
   * @example
   * ```ts
   * events.trigger('my-event', 'arg1', 'arg2');
   * ```
   *
   * @public
   */
  public trigger(name: string, ...args: unknown[]): void {
    const eventRefs = this.eventRefsMap.get(name) ?? [];
    for (const eventRef of eventRefs.slice()) {
      this.tryTrigger(eventRef, args);
    }
  }

  /**
   * Trigger an event asynchronously, executing all the listeners in order even if some of them throw an error.
   *
   * @param name - The name of the event.
   * @param args - The data to pass to the event listeners.
   *
   * @public
   */
  public async triggerAsync(name: string, ...args: unknown[]): Promise<void> {
    const eventRefs = this.eventRefsMap.get(name) ?? [];
    for (const eventRef of eventRefs.slice()) {
      await this.tryTriggerAsync(eventRef, args);
    }
  }

  /**
   * Try to trigger an event, executing all the listeners in order even if some of them throw an error.
   *
   * @param eventRef - The event reference.
   * @param args - The data to pass to the event listeners.
   *
   * @example
   * ```ts
   * events.tryTrigger(myRef, ['arg1', 'arg2']);
   * ```
   *
   * @public
   */
  public tryTrigger(eventRef: AsyncEventRef, args: unknown[]): void {
    try {
      eventRef.callback.apply(eventRef.thisArg, args);
    } catch (e) {
      setTimeout(() => {
        throw e;
      }, 0);
    }
  }

  /**
   * Try to trigger an event asynchronously, executing all the listeners in order even if some of them throw an error.
   *
   * @param eventRef - The event reference.
   * @param args - The data to pass to the event listeners.
   *
   * @public
   */
  public async tryTriggerAsync(eventRef: AsyncEventRef, args: unknown[]): Promise<void> {
    try {
      const result = eventRef.callback.call(eventRef.thisArg, ...args);
      await (result as Promise<void>);
    } catch (e) {
      setTimeout(() => {
        throw e;
      }, 0);
    }
  }
}

/*

Var fs = (function () {
        return (
          (e.prototype.offref = function (e) {
          }),
          (e.prototype.trigger = function (e) {
            for (var t = [], n = 1; n < arguments.length; n++)
              t[n - 1] = arguments[n];
            var r = this._[e];
            if (r) {
              r = r.slice();
              for (var a = 0; a < r.length; a++) this.tryTrigger(r[a], t);
            }
          }),
          (e.prototype.tryTrigger = function (e, t) {
            try {
              e.fn.apply(e.ctx, t);
            } catch (e) {
              setTimeout(function () {
                throw e;
              }, 0);
            }
          }),
          e
        );
      })();
*/
