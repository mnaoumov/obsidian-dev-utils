/**
 *
 * @packageDocumentation MonkeyAround
 * Improved type-safe wrapper of {@link https://www.npmjs.com/package/monkey-around} library.
 */

import type { Component } from 'obsidian';
import type { ConditionalKeys } from 'type-fest';

import { around as originalAround } from 'monkey-around';

/**
 * The type of the factories to apply to the object.
 *
 * @typeParam Obj - The object to patch.
 */
export type Factories<Obj extends object> = Partial<
  {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    [Key in ConditionalKeys<Obj, Function>]: WrapperFactory<Extract<Obj[Key], Function>>;
  }
>;

type OriginalFactories<Obj extends Record<string, unknown>> = Parameters<typeof originalAround<Obj>>[1];

type Uninstaller = () => void;

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type WrapperFactory<T extends Function> = (next: T) => T;

/**
 * Applies a patch to the object.
 * Better strongly-typed version of `monkey-around`.
 *
 * @typeParam Obj - The object to patch.
 * @param obj - The object to patch.
 * @param factories - The factories to apply to the object.
 */
export function around<Obj extends object>(obj: Obj, factories: Factories<Obj>): Uninstaller {
  return originalAround(obj as Record<string, unknown>, factories as OriginalFactories<Record<string, unknown>>);
}

/**
 * Invokes a function with a patch applied to the object.
 * The patch is automatically removed when the function returns.
 *
 * @typeParam Obj - The object to patch.
 * @typeParam Result - The type of the result of the function.
 * @param obj - The object to patch.
 * @param factories - The factories to apply to the object.
 * @param fn - The function to invoke.
 * @returns The result of the function.
 */
export function invokeWithPatch<Obj extends object, Result>(obj: Obj, factories: Factories<Obj>, fn: () => Result): Result {
  const uninstaller = around(obj, factories);
  try {
    return fn();
  } finally {
    uninstaller();
  }
}

/**
 * Invokes an async function with a patch applied to the object.
 * The patch is automatically removed when the function returns.
 *
 * @typeParam Obj - The object to patch.
 * @typeParam Result - The type of the result of the function.
 * @param obj - The object to patch.
 * @param factories - The factories to apply to the object.
 * @param fn - The function to invoke.
 * @returns The result of the function.
 */
export async function invokeWithPatchAsync<Obj extends object, Result>(obj: Obj, factories: Factories<Obj>, fn: () => Promise<Result>): Promise<Result> {
  const uninstaller = around(obj, factories);
  try {
    return await fn();
  } finally {
    uninstaller();
  }
}

/**
 * Registers a patch to the object.
 *
 * @typeParam Obj - The object to patch.
 * @param component - The component to register the patch to.
 * @param obj - The object to patch.
 * @param factories - The factories to apply to the object.
 * @returns The uninstaller.
 */
export function registerPatch<Obj extends object>(component: Component, obj: Obj, factories: Factories<Obj>): Uninstaller {
  const uninstaller = around(obj, factories);
  let isUninstalled = false;

  function uninstallerWrapper(): void {
    if (isUninstalled) {
      return;
    }
    try {
      uninstaller();
    } finally {
      isUninstalled = true;
    }
  }

  component.register(uninstallerWrapper);
  return uninstaller;
}
