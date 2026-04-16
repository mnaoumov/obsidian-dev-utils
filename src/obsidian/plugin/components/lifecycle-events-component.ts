/**
 * @file
 *
 * Component that manages plugin lifecycle events (load, layoutReady, unload).
 */

import type { App } from 'obsidian';

import { AsyncEvents } from '../../../async-events.ts';
import {
  convertAsyncToSync,
  invokeAsyncSafely
} from '../../../async.ts';
import { AsyncComponentBase } from '../../components/async-component-base.ts';

/**
 * The name of a lifecycle event.
 */
export type LifecycleEventName = 'layoutReady' | 'load' | 'unload';

/**
 * Manages plugin lifecycle events: `load`, `layoutReady`, and `unload`.
 *
 * Components can wait for or register callbacks for these events.
 */
export class LifecycleEventsComponent extends AsyncComponentBase {
  /**
   * The async events instance.
   */
  public readonly events = new AsyncEvents();

  private readonly triggeredEvents = new Set<LifecycleEventName>();

  /**
   * Creates a new lifecycle events component.
   *
   * @param app - The Obsidian app instance.
   */
  public constructor(private readonly app: App) {
    super();
  }

  /**
   * Triggers load and registers layoutReady callback.
   */
  public override async onload(): Promise<void> {
    await this.triggerLifecycleEvent('load');
    this.app.workspace.onLayoutReady(convertAsyncToSync(async () => {
      await this.triggerLifecycleEvent('layoutReady');
    }));
  }

  /**
   * Triggers the unload lifecycle event.
   */
  public override onunload(): void {
    invokeAsyncSafely(async () => {
      await this.triggerLifecycleEvent('unload');
    });
  }

  /**
   * Registers a callback to be executed when a lifecycle event is triggered.
   *
   * @param name - The name of the event.
   * @param callback - The callback to execute.
   */
  public async registerForLifecycleEvent(name: LifecycleEventName, callback: () => Promise<void>): Promise<void> {
    await this.waitForLifecycleEvent(name);
    await callback();
  }

  /**
   * Triggers a lifecycle event.
   *
   * @param name - The name of the lifecycle event to trigger.
   */
  public async triggerLifecycleEvent(name: LifecycleEventName): Promise<void> {
    this.triggeredEvents.add(name);
    await this.events.triggerAsync(name);
  }

  /**
   * Waits for a lifecycle event to be triggered.
   *
   * @param name - The name of the event.
   * @returns A {@link Promise} that resolves when the event is triggered.
   */
  public async waitForLifecycleEvent(name: LifecycleEventName): Promise<void> {
    if (this.triggeredEvents.has(name)) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.events.once(name, () => {
        resolve();
      });
    });
  }
}
