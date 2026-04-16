/**
 * @file
 *
 * Base class for components that need async lifecycle methods.
 */

import type { Promisable } from 'type-fest';

import { Component } from 'obsidian';

/**
 * A {@link Component} that supports async lifecycle methods.
 *
 * Obsidian's `Component.load()` captures the return value of `onload()` and includes Promises
 * in a `Promise.all()`. This class overrides `load()` to `await` `onload()` before loading children,
 * ensuring ordered initialization.
 */
export abstract class AsyncComponentBase extends Component {
  /**
   * Loads this component and its children sequentially.
   *
   * Unlike Component's `load()` which runs `onload()` and children concurrently,
   * this awaits `onload()` first, then loads children in order.
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Obsidian's load() handles async returns at runtime.
  public override async load(): Promise<void> {
    if (this._loaded) {
      return;
    }
    this._loaded = true;
    await this.onload();

    for (const child of this._children) {
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Component.load() returns void|Promise at runtime despite void typing.
      await (child.load() as Promisable<void>);
    }
  }

  /**
   * Override this method to perform async initialization.
   *
   * @returns A {@link Promise} that resolves when initialization is complete.
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Intentional async override; called from our own async load().
  public override async onload(): Promise<void> {
    await Promise.resolve();
  }
}
