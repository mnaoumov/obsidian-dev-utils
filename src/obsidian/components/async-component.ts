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
    await loadAsync(this);
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

/**
 * Loads a component and its children sequentially.
 *
 * @param component - The component to load.
 * @returns A {@link Promise} that resolves when the component is loaded.
 */
export async function loadAsync(component: Component): Promise<void> {
  if (component._loaded) {
    return;
  }
  component._loaded = true;
  // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Component.load() returns void|Promise at runtime despite void typing.
  await (component.onload() as Promisable<void>);

  for (const child of component._children) {
    await loadAsync(child);
  }
}

/**
 * Loads a component and its children (children first).
 *
 * @param component - The component to load.
 * @returns A {@link Promise} that resolves when the component is loaded.
 */
export async function loadChildrenFirstAsync(component: Component): Promise<void> {
  if (component._loaded) {
    return;
  }

  for (const child of component._children) {
    await loadChildrenFirstAsync(child);
  }

  component._loaded = true;
  // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Component.load() returns void|Promise at runtime despite void typing.
  await (component.onload() as Promisable<void>);
}
