/**
 * @file
 *
 * Interface for components that need to perform work when the workspace layout is ready.
 */

import type { App } from 'obsidian';
import type { Promisable } from 'type-fest';

import { invokeAsyncSafely } from '../../async.ts';
import { noop } from '../../function.ts';
import { ComponentEx } from './component-ex.ts';

/**
 * A component that executes a callback function when the Obsidian layout becomes ready.
 */
export class LayoutReadyComponent extends ComponentEx {
  /**
   * Creates a new LayoutReadyComponent instance.
   *
   * @param app - The Obsidian App instance.
   */
  public constructor(protected readonly app: App) {
    super();
  }

  /**
   * Loads the component and registers the layout ready handler.
   */
  public override onload(): void {
    this.app.workspace.onLayoutReady(() => {
      window.setTimeout(() => {
        if (!this._loaded) {
          return;
        }

        const inFlightLoadPromise = this.getInFlightLoadPromise();
        if (!inFlightLoadPromise) {
          invokeAsyncSafely(this.onLayoutReady.bind(this));
          return;
        }

        // Loaded after the layout was already ready: `onload` has run but the async load (`onloadAsync` and
        // Children) may still be in flight. Wait for it before running `onLayoutReady`, otherwise the handler
        // Races the load and can observe half-initialized state (e.g. a startup script that has not finished
        // Loading yet).
        invokeAsyncSafely(async () => {
          await inFlightLoadPromise;
          if (this._loaded) {
            await this.onLayoutReady();
          }
        });
      }, 0);
    });
  }

  /**
   * Executes when the Obsidian layout becomes ready.
   */
  protected onLayoutReady(): Promisable<void> {
    noop();
  }
}

/**
 * A {@link LayoutReadyComponent} subclass that invokes a provided callback function when the layout becomes ready.
 */
export class CallbackLayoutReadyComponent extends LayoutReadyComponent {
  /**
   * Creates a new CallbackLayoutReadyComponent instance.
   *
   * @param app - The Obsidian App instance.
   * @param callback - The callback to invoke when layout is ready.
   */
  public constructor(app: App, protected readonly callback: () => Promisable<void>) {
    super(app);
  }

  /**
   * Executes when the Obsidian layout becomes ready.
   *
   * @returns The result of invoking the callback.
   */
  protected override onLayoutReady(): Promisable<void> {
    return this.callback();
  }
}
