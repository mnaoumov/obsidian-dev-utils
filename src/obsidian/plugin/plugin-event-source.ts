/**
 * @file
 *
 * Contains the implementation of the plugin event source.
 */

import type { Promisable } from 'type-fest';

import type {
  AsyncEventRef,
  AsyncEventSource
} from '../../async-events.ts';
import type { StringKeys } from '../../type.ts';
import type { PluginBase } from './plugin.ts';

/**
 * Event map for plugin events.
 */
export interface PluginEventMap {
  /** Fired when plugin settings are changed externally (e.g. sync, manual file edit). */
  externalSettingsChange: [];
}

/**
 * Event source for plugin events.
 */
export type PluginEventSource = AsyncEventSource<PluginEventMap>;

/**
 * Plugin event source implementation.
 */
export class PluginEventSourceImpl implements PluginEventSource {
  /**
   * Creates a new plugin event source.
   *
   * @param plugin - The plugin to create the event source for.
   */
  public constructor(private readonly plugin: PluginBase) {}

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
  public off<EventName extends StringKeys<PluginEventMap>, Args extends EventName extends StringKeys<PluginEventMap> ? PluginEventMap[EventName] : unknown[]>(
    name: EventName,
    callback: (...args: Args) => Promisable<void>
  ): void {
    this.plugin.off(name, callback);
  }

  /**
   * Remove an event listener by reference.
   *
   * @param eventRef - The reference to remove.
   */
  public offref(eventRef: AsyncEventRef): void {
    this.plugin.offref(eventRef);
  }

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
  public on<EventName extends StringKeys<PluginEventMap>, Args extends EventName extends StringKeys<PluginEventMap> ? PluginEventMap[EventName] : unknown[]>(
    name: EventName,
    callback: (...args: Args) => Promisable<void>,
    thisArg?: unknown
  ): AsyncEventRef {
    return this.plugin.on(name, callback, thisArg);
  }

  /**
   * Add an event listener that will be triggered only once.
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
   * events.once('my-event', async (arg1, arg2) => {
   *     await sleep(100);
   *     console.log(arg1, arg2);
   * });
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
  public once<EventName extends StringKeys<PluginEventMap>, Args extends EventName extends StringKeys<PluginEventMap> ? PluginEventMap[EventName] : unknown[]>(
    name: EventName,
    callback: (...args: Args) => Promisable<void>,
    thisArg?: unknown
  ): AsyncEventRef {
    return this.plugin.once(name, callback, thisArg);
  }
}
