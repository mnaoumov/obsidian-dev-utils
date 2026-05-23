/**
 * @file
 *
 * Async event emitter.
 */

import type {
  AbstractConstructor,
  Promisable
} from 'type-fest';

import type { GenericPromisableVoidFunction } from './function.ts';
import type { StringKeys } from './type.ts';

import { filterInPlace } from './array.ts';

/**
 * Async event reference.
 */
export interface AsyncEventRef {
  /**
   * An event source.
   */
  asyncEventSource: GenericAsyncEventSource;

  /**
   * A callback to call when the event is triggered.
   */
  callback: GenericCallback;

  /**
   * A name of the event.
   */
  name: string;

  /**
   * A context passed as `this` to the `callback`.
   */
  thisArg: unknown;
}

/**
 * Async event emitter implementation.
 *
 * @typeParam EventMap - Maps event names to their argument tuples.
 * When omitted, the emitter accepts any string event name with any arguments.
 * When provided, methods enforce correct event names and argument types
 * with full autocomplete. Works with both `type` aliases and `interface` declarations.
 *
 * @example
 * ```ts
 * // Untyped (default) — any event name, any args:
 * const events = new AsyncEvents();
 * events.on('my-event', (arg1: string) => { ... });
 *
 * // Typed — only declared events with correct args:
 * interface MyEventMap {
 *   save: [data: string];
 *   load: [id: number, force: boolean];
 * }
 * const events = new AsyncEvents<MyEventMap>();
 * events.on('save', (data) => { ... });   // data: string — autocomplete on event name
 * events.on('load', (id, force) => { ... }); // id: number, force: boolean
 * ```
 */
export interface AsyncEventSource<EventMap extends EventMapConstraint<EventMap> = EventMapBase> extends GenericAsyncEventSource {
  /**
   * Remove an event listener.
   *
   * @typeParam EventName - The name of the event.
   * @typeParam Args - The arguments of the event.
   * @param name - The name of the event.
   * @param callback - The callback to remove.
   *
   * @example
   * ```ts
   * events.off('my-event', myListener);
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
  off<EventName extends StringKeys<EventMap>, Args extends CallbackArgs<EventMap, EventName>>(
    name: EventName,
    callback: (...args: Args) => Promisable<void>
  ): void;

  /**
   * Add an event listener.
   *
   * @typeParam EventName - The name of the event.
   * @typeParam Args - The arguments of the event.
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
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
  on<EventName extends StringKeys<EventMap>, Args extends CallbackArgs<EventMap, EventName>>(
    name: EventName,
    callback: (...args: Args) => Promisable<void>,
    thisArg?: unknown
  ): AsyncEventRef;

  /**
   * Add an event listener that will be triggered only once.
   *
   * @typeParam EventName - The name of the event.
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
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
  once<EventName extends StringKeys<EventMap>, Args extends CallbackArgs<EventMap, EventName>>(
    name: EventName,
    callback: (...args: Args) => Promisable<void>,
    thisArg?: unknown
  ): AsyncEventRef;
}

/**
 * Resolves callback argument types for an event.
 *
 * - When `EventMap` has an index signature (untyped default): returns `unknown[]`,
 *   allowing `Args` to be inferred freely from the callback.
 * - When `EventMap` has explicit keys only (typed map): returns `EventMap[EventName]`,
 *   enforcing the declared argument types and enabling autocomplete.
 *
 * @typeParam EventMap - Maps event names to their argument tuples.
 * @typeParam EventName - The name of the event.
 */
export type CallbackArgs<EventMap, EventName extends string> = string extends keyof EventMap ? unknown[]
  : (EventName extends keyof EventMap ? EventMap[EventName] : unknown[]);

/**
 * Base event map type for untyped emitters.
 */
export type EventMapBase = Record<string, unknown[]>;

/**
 * Interface for event source, used by {@link AsyncEventRef}
 * so that refs can be stored regardless of the emitter's `EventMap`.
 */
export interface GenericAsyncEventSource {
  /**
   * Remove an event listener by reference.
   *
   * @param eventRef - The reference to remove.
   */
  offref(eventRef: AsyncEventRef): void;
}

type EventMapConstraint<T> = Record<keyof T, unknown[]>;

type GenericCallback = GenericPromisableVoidFunction<unknown[]>;

/**
 * Async event source implementation.
 *
 * @typeParam EventMap - Maps event names to their argument tuples.
 * When omitted, the emitter accepts any string event name with any arguments.
 * When provided, methods enforce correct event names and argument types
 * with full autocomplete. Works with both `type` aliases and `interface` declarations.
 *
 * @example
 * ```ts
 * // Untyped (default) — any event name, any args:
 * const events = new AsyncEvents();
 * events.on('my-event', (arg1: string) => { ... });
 *
 * // Typed — only declared events with correct args:
 * interface MyEventMap {
 *   save: [data: string];
 *   load: [id: number, force: boolean];
 * }
 * const events = new AsyncEvents<MyEventMap>();
 * events.on('save', (data) => { ... });   // data: string — autocomplete on event name
 * events.on('load', (id, force) => { ... }); // id: number, force: boolean
 * ```
 */
export abstract class AsyncEventsBase<EventMap extends EventMapConstraint<EventMap> = EventMapBase> implements AsyncEventSource<EventMap> {
  private readonly eventRefsMap = new Map<string, AsyncEventRef[]>();

  /**
   * Remove an event listener.
   *
   * @typeParam EventName - The name of the event.
   * @typeParam Args - The types of the arguments the event callback accepts.
   * @param name - The name of the event.
   * @param callback - The callback to remove.
   *
   * @example
   * ```ts
   * events.off('my-event', myListener);
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
  public off<EventName extends StringKeys<EventMap>, Args extends CallbackArgs<EventMap, EventName>>(
    name: EventName,
    callback: (...args: Args) => Promisable<void>
  ): void {
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
   * @typeParam EventName - The name of the event.
   * @typeParam Args - The types of the arguments the event callback accepts.
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
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
  public on<EventName extends StringKeys<EventMap>, Args extends CallbackArgs<EventMap, EventName>>(
    name: EventName,
    callback: (...args: Args) => Promisable<void>,
    thisArg?: unknown
  ): AsyncEventRef {
    let eventRefs = this.eventRefsMap.get(name);
    if (!eventRefs) {
      eventRefs = [];
      this.eventRefsMap.set(name, eventRefs);
    }

    const eventRef: AsyncEventRef = {
      asyncEventSource: this,
      callback: callback as GenericCallback,
      name,
      thisArg
    };
    eventRefs.push(eventRef);
    return eventRef;
  }

  /**
   * Add an event listener that will be triggered only once.
   *
   * @typeParam EventName - The name of the event.
   * @typeParam Args - The types of the arguments the event callback accepts.
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
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
  public once<EventName extends StringKeys<EventMap>, Args extends CallbackArgs<EventMap, EventName>>(
    name: EventName,
    callback: (...args: Args) => Promisable<void>,
    thisArg?: unknown
  ): AsyncEventRef {
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
   * @typeParam EventName - The name of the event.
   * @param name - The name of the event.
   * @param args - The data to pass to the event listeners.
   *
   * @example
   * ```ts
   * events.trigger('my-event', 'arg1', 'arg2');
   * ```
   */
  protected trigger<EventName extends StringKeys<EventMap>>(name: EventName, ...args: CallbackArgs<EventMap, EventName>): void {
    const eventRefs = this.eventRefsMap.get(name) ?? [];
    for (const eventRef of eventRefs.slice()) {
      this.tryTrigger(eventRef, args);
    }
  }

  /**
   * Trigger an event asynchronously, executing all the listeners in order even if some of them throw an error.
   *
   * @typeParam EventName - The name of the event.
   * @param name - The name of the event.
   * @param args - The data to pass to the event listeners.
   * @returns A {@link Promise} that resolves when all listeners have completed.
   */
  protected async triggerAsync<EventName extends StringKeys<EventMap>>(name: EventName, ...args: CallbackArgs<EventMap, EventName>): Promise<void> {
    const eventRefs = this.eventRefsMap.get(name) ?? [];
    for (const eventRef of eventRefs.slice()) {
      await this.tryTriggerAsync(eventRef, args);
    }
  }

  /**
   * Try to trigger an event, executing all the listeners in order even if some of them throw an error.
   *
   * @typeParam Args - The types of the arguments the function accepts.
   * @param eventRef - The event reference.
   * @param args - The data to pass to the event listeners.
   *
   * @example
   * ```ts
   * events.tryTrigger(myRef, ['arg1', 'arg2']);
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
  protected tryTrigger<Args extends unknown[]>(eventRef: AsyncEventRef, args: Args): void {
    try {
      const result = eventRef.callback.call(eventRef.thisArg, ...args);
      if (result instanceof Promise) {
        result.catch(throwDelayed);
      }
    } catch (e) {
      throwDelayed(e);
    }
  }

  /**
   * Try to trigger an event asynchronously, executing all the listeners in order even if some of them throw an error.
   *
   * @typeParam Args - The types of the arguments the function accepts.
   * @param eventRef - The event reference.
   * @param args - The data to pass to the event listeners.
   * @returns A {@link Promise} that resolves when all listeners have completed.
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
  protected async tryTriggerAsync<Args extends unknown[]>(eventRef: AsyncEventRef, args: Args): Promise<void> {
    try {
      await eventRef.callback.call(eventRef.thisArg, ...args);
    } catch (e) {
      throwDelayed(e);
    }
  }
}

/**
 * A class that extends {@link AsyncEventsBase} and provides public methods for triggering events.
 *
 * This class exists as parity with {@link obsidian#Events}. But exposing publicly `trigger()` methods violates encapsulation.
 *
 * Avoid using it in favor of {@link AsyncEventsBase}.
 *
 * @typeParam EventMap - The type of the event map.
 */
export class AsyncEvents<EventMap extends EventMapConstraint<EventMap> = EventMapBase> extends AsyncEventsBase<EventMap> {
  /**
   * Trigger an event, executing all the listeners in order even if some of them throw an error.
   *
   * @typeParam EventName - The name of the event.
   * @param name - The name of the event.
   * @param args - The data to pass to the event listeners.
   */
  public override trigger<EventName extends StringKeys<EventMap>>(name: EventName, ...args: CallbackArgs<EventMap, EventName>): void {
    super.trigger(name, ...args);
  }

  /**
   * Trigger an event asynchronously, executing all the listeners in order even if some of them throw an error.
   *
   * @typeParam EventName - The name of the event.
   * @param name - The name of the event.
   * @param args - The data to pass to the event listeners.
   * @returns A {@link Promise} that resolves when all listeners have completed.
   */
  public override triggerAsync<EventName extends StringKeys<EventMap>>(name: EventName, ...args: CallbackArgs<EventMap, EventName>): Promise<void> {
    return super.triggerAsync(name, ...args);
  }

  /**
   * Try to trigger an event, executing all the listeners in order even if some of them throw an error.
   *
   * @typeParam Args - The types of the arguments the function accepts.
   * @param eventRef - The event reference.
   * @param args - The data to pass to the event listeners.
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
  public override tryTrigger<Args extends unknown[]>(eventRef: AsyncEventRef, args: Args): void {
    super.tryTrigger(eventRef, args);
  }

  /**
   * Try to trigger an event asynchronously, executing all the listeners in order even if some of them throw an error.
   *
   * @typeParam Args - The types of the arguments the function accepts.
   * @param eventRef - The event reference.
   * @param args - The data to pass to the event listeners.
   * @returns A {@link Promise} that resolves when all listeners have completed.
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
  public override async tryTriggerAsync<Args extends unknown[]>(eventRef: AsyncEventRef, args: Args): Promise<void> {
    return super.tryTriggerAsync(eventRef, args);
  }
}

/**
 * Mixin that adds {@link AsyncEventSource} delegation to a base class.
 *
 * All event methods delegate to a private {@link AsyncEventsBase} instance.
 * The `EventMap` generic is fixed at mixin-application time — if you need a class
 * that is itself generic over its event map, use composition instead.
 *
 * @typeParam EventMap - Maps event names to their argument tuples.
 * @returns A function that takes a base class and returns a new class extending it with {@link AsyncEventSource}.
 *
 * @example
 * ```ts
 * interface MyEvents {
 *   save: [data: string];
 * }
 * class MyComponent extends mixinAsyncEvents<MyEvents>()(Component) {
 *   // on(), off(), once(), offref() are available
 * }
 * ```
 */
export function mixinAsyncEvents<EventMap extends EventMapConstraint<EventMap> = EventMapBase>() {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Return type is inferred from the class expression; spelling it out would duplicate the entire class shape.
  return function inner<TBase extends AbstractConstructor<object>>(baseClass: TBase) {
    abstract class AsyncEventsMixin extends baseClass implements AsyncEventSource<EventMap> {
      private readonly asyncEvents = new AsyncEvents<EventMap>();

      /**
       * Remove an event listener.
       *
       * @typeParam EventName - The name of the event.
       * @typeParam Args - The types of the arguments the event callback accepts.
       * @param name - The name of the event.
       * @param callback - The callback to remove.
       */
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
      public off<EventName extends StringKeys<EventMap>, Args extends CallbackArgs<EventMap, EventName>>(
        name: EventName,
        callback: (...args: Args) => Promisable<void>
      ): void {
        this.asyncEvents.off(name, callback);
      }

      /**
       * Remove an event listener by reference.
       *
       * @param eventRef - The event reference to remove.
       */
      public offref(eventRef: AsyncEventRef): void {
        this.asyncEvents.offref(eventRef);
      }

      /**
       * Add an event listener.
       *
       * @typeParam EventName - The name of the event.
       * @typeParam Args - The types of the arguments the event callback accepts.
       * @param name - The name of the event.
       * @param callback - The callback to call when the event is triggered.
       * @param thisArg - The context passed as `this` to the `callback`.
       * @returns A reference to the event listener.
       */
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
      public on<EventName extends StringKeys<EventMap>, Args extends CallbackArgs<EventMap, EventName>>(
        name: EventName,
        callback: (...args: Args) => Promisable<void>,
        thisArg?: unknown
      ): AsyncEventRef {
        return this.asyncEvents.on(name, callback, thisArg);
      }

      /**
       * Add an event listener that will be called only once.
       *
       * @typeParam EventName - The name of the event.
       * @typeParam Args - The types of the arguments the event callback accepts.
       * @param name - The name of the event.
       * @param callback - The callback to call when the event is triggered.
       * @param thisArg - The context passed as `this` to the `callback`.
       * @returns A reference to the event listener.
       */
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
      public once<EventName extends StringKeys<EventMap>, Args extends CallbackArgs<EventMap, EventName>>(
        name: EventName,
        callback: (...args: Args) => Promisable<void>,
        thisArg?: unknown
      ): AsyncEventRef {
        return this.asyncEvents.once(name, callback, thisArg);
      }

      /**
       * Trigger an event, executing all the listeners in order even if some of them throw an error.
       *
       * @typeParam EventName - The name of the event.
       * @param name - The name of the event.
       * @param args - The data to pass to the event listeners.
       */
      protected trigger<EventName extends StringKeys<EventMap>>(name: EventName, ...args: CallbackArgs<EventMap, EventName>): void {
        this.asyncEvents.trigger(name, ...args);
      }

      /**
       * Trigger an event asynchronously.
       *
       * @typeParam EventName - The name of the event.
       * @param name - The name of the event.
       * @param args - The data to pass to the event listeners.
       * @returns A {@link Promise} that resolves when all listeners have completed.
       */
      protected async triggerAsync<EventName extends StringKeys<EventMap>>(name: EventName, ...args: CallbackArgs<EventMap, EventName>): Promise<void> {
        await this.asyncEvents.triggerAsync(name, ...args);
      }

      /**
       * Try to trigger an event, executing all the listeners in order even if some of them throw an error.
       *
       * @typeParam Args - The types of the arguments the function accepts.
       * @param eventRef - The event reference.
       * @param args - The data to pass to the event listeners.
       */
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- Parity with Obsidian's Events.tryTrigger.
      protected tryTrigger<Args extends unknown[]>(eventRef: AsyncEventRef, args: Args): void {
        this.asyncEvents.tryTrigger(eventRef, args);
      }

      /**
       * Try to trigger an event asynchronously, executing all the listeners in order even if some of them throw an error.
       *
       * @typeParam Args - The types of the arguments the function accepts.
       * @param eventRef - The event reference.
       * @param args - The data to pass to the event listeners.
       * @returns A {@link Promise} that resolves when all listeners have completed.
       */
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- Parity with Obsidian's Events.tryTrigger.
      protected async tryTriggerAsync<Args extends unknown[]>(eventRef: AsyncEventRef, args: Args): Promise<void> {
        await this.asyncEvents.tryTriggerAsync(eventRef, args);
      }
    }

    return AsyncEventsMixin;
  };
}

function throwDelayed(error: unknown): void {
  window.setTimeout(() => {
    throw error;
  }, 0);
}
