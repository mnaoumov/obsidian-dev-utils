/**
 * @file
 *
 * Typed helpers for subscribing to an Obsidian {@link Events} source. Both derive the valid event names and their
 * callback argument types from the source's overloaded `on` method (via {@link ExtractEventMap}), so the event
 * name and handler are fully autocompleted. {@link subscribeEvent} returns the raw {@link EventRef} (parity with
 * {@link Events.on}); {@link subscribeDisposableEvent} returns a {@link DisposableEx} that unregisters it.
 */

import type {
  EventRef,
  Events
} from 'obsidian';

import type { DisposableEx } from '../disposable.ts';
import type { GenericFunction } from '../function.ts';
import type { ExtractEventMap } from '../type.ts';

import { DisposableBase } from '../disposable.ts';
import { castTo } from '../object-utils.ts';

/**
 * Parameters for {@link subscribeDisposableEvent}. Same shape as {@link SubscribeEventParams}.
 *
 * @typeParam Source - The {@link Events} source type.
 * @typeParam EventName - The event name, constrained to the source's known events.
 */
export type SubscribeDisposableEventParams<Source extends Events, EventName extends EventNameOf<Source>> = SubscribeEventParams<
  Source,
  EventName
>;

/**
 * Parameters for {@link subscribeEvent}.
 *
 * @typeParam Source - The {@link Events} source type.
 * @typeParam EventName - The event name, constrained to the source's known events.
 */
export interface SubscribeEventParams<Source extends Events, EventName extends EventNameOf<Source>> {
  /**
   * The event callback. Its argument types are inferred from {@link SubscribeEventParams.name}.
   */
  readonly callback: EventCallbackOf<Source, EventName>;

  /**
   * The event source to subscribe on.
   */
  readonly events: Source;

  /**
   * The event name to subscribe to.
   */
  readonly name: EventName;

  /**
   * The context passed as `this` to the callback.
   */
  readonly thisArg?: unknown;
}

/**
 * The callback type for a given event on a {@link Events} source, with its argument tuple inferred from
 * {@link ExtractEventMap}.
 *
 * @typeParam Source - The {@link Events} source type.
 * @typeParam EventName - The event name.
 */
type EventCallbackOf<Source extends Events, EventName extends EventNameOf<Source>> = ExtractEventMap<Source>[EventName] extends infer Args extends unknown[] ? (...args: Args) => unknown
  : never;

/**
 * The union of known event names for a {@link Events} source, derived from its `on` overloads.
 *
 * @typeParam Source - The {@link Events} source type.
 */
type EventNameOf<Source extends Events> = keyof ExtractEventMap<Source> & string;

/**
 * A {@link DisposableEx} that unregisters an Obsidian {@link EventRef} on dispose, via the event source exposed on
 * the ref itself (`eventRef.e`).
 */
export class EventRefDisposable extends DisposableBase {
  /**
   * Creates a disposable wrapping an existing {@link EventRef}.
   *
   * @param eventRef - The event reference to unregister on dispose.
   */
  public constructor(private readonly eventRef: EventRef) {
    super();
  }

  /**
   * Unregisters the event via the source stored on the ref (`eventRef.e.offref`).
   */
  protected override performDispose(): void {
    this.eventRef.e.offref(this.eventRef);
  }
}

/**
 * Subscribes to an event on an {@link Events} source and returns a {@link DisposableEx} that unregisters it on
 * dispose. Typed wrapper over {@link Events.on}: the event name and callback arguments are autocompleted from the
 * source's overloads.
 *
 * @typeParam Source - The {@link Events} source type.
 * @typeParam EventName - The event name.
 * @param params - The subscription parameters.
 * @returns A {@link DisposableEx} that unregisters the handler when disposed.
 */
export function subscribeDisposableEvent<Source extends Events, EventName extends EventNameOf<Source>>(
  params: SubscribeDisposableEventParams<Source, EventName>
): DisposableEx {
  return new EventRefDisposable(subscribeEvent(params));
}

/**
 * Subscribes to an event on an {@link Events} source and returns the raw {@link EventRef} (parity with
 * {@link Events.on}). Typed wrapper: the event name and callback arguments are autocompleted from the source's
 * overloads.
 *
 * @typeParam Source - The {@link Events} source type.
 * @typeParam EventName - The event name.
 * @param params - The subscription parameters.
 * @returns The {@link EventRef} for the registered handler.
 */
export function subscribeEvent<Source extends Events, EventName extends EventNameOf<Source>>(
  params: SubscribeEventParams<Source, EventName>
): EventRef {
  // A generic `name` cannot select one of `on`'s specific overloads, so the call resolves against the base
  // `on(name: string, callback, ctx?)` signature — the callback is cast to that signature's parameter type.
  return params.events.on(params.name, castTo<GenericFunction<unknown[]>>(params.callback), params.thisArg);
}
