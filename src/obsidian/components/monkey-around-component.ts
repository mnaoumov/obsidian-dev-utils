/**
 * @file
 *
 * Improved type-safe wrapper of {@link https://www.npmjs.com/package/monkey-around} library.
 */

import type { ConditionalKeys } from 'type-fest';

import { around as originalAround } from 'monkey-around';
import { Component } from 'obsidian';

import type { GenericObject } from '../../type-guards.ts';

import { DisposableComponent } from './disposable-component.ts';

/**
 * A type of the factories to apply to the object.
 *
 * @typeParam Obj - The object to patch.
 */
export type Factories<Obj extends object> = Partial<
  {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- We need to use `Function` type as a generic restriction.
    [Key in ConditionalKeys<Obj, Function | undefined>]: WrapperFactory<Extract<Obj[Key], Function | undefined>>;
  }
>;

/**
 * A patch handler function that intercepts calls to a method on an object.
 *
 * @typeParam Obj - The object being patched.
 * @typeParam K - The method name being patched.
 */
export type PatchHandlerFn<Obj extends object, K extends MethodKeys<Obj>> = (
  params: PatchHandlerParams<Obj, K>
) => ReturnType<Extract<Obj[K], (...args: never[]) => unknown>>;

/**
 * Parameters passed to a {@link PatchHandlerFn} callback.
 *
 * @typeParam Obj - The object being patched.
 * @typeParam K - The method name being patched.
 */
export interface PatchHandlerParams<Obj extends object, K extends MethodKeys<Obj>> {
  /**
   * The original arguments of the intercepted call, as a tuple.
   */
  readonly originalArgs: Parameters<Extract<Obj[K], (...args: never[]) => unknown>>;

  /**
   * The original (unpatched) function. Call via `originalFn.call(originalThis, ...originalArgs)`.
   */
  readonly originalFn: Extract<Obj[K], (...args: never[]) => unknown>;

  /**
   * The original `this` context of the intercepted call.
   */
  readonly originalThis: Obj;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- We need to use `Function` type as a generic restriction.
type MethodKeys<Obj extends object> = ConditionalKeys<Obj, Function | undefined>;

type OriginalFactories<Obj extends GenericObject> = Parameters<typeof originalAround<Obj>>[1];

type Uninstaller = () => void;

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- We need to use `Function` type as a generic restriction.
type WrapperFactory<T extends Function | undefined> = (next: T) => T;

/**
 * A component that manages monkey-patches with lifecycle-bound cleanup.
 * All patches registered via this component are automatically uninstalled when the component unloads.
 */
export class MonkeyAroundComponent extends DisposableComponent {
  /**
   * Registers a single-method patch using a simplified handler.
   *
   * @typeParam Obj - The object to patch.
   * @typeParam K - The method name to patch.
   * @param obj - The object to patch.
   * @param methodName - The name of the method to patch.
   * @param handler - The patch handler function receiving `originalFn`, `originalThis`, and `originalArgs`.
   */
  public registerMethodPatch<Obj extends object, K extends MethodKeys<Obj>>(
    obj: Obj,
    methodName: K,
    handler: PatchHandlerFn<Obj, K>
  ): void {
    type Fn = Extract<Obj[K], (...args: never[]) => unknown>;
    this.registerPatch(obj, {
      [methodName]: (originalFn: Fn): Fn => {
        return function patchedMethod(this: Obj, ...originalArgs: Parameters<Fn>): ReturnType<Fn> {
          return handler({ originalArgs, originalFn, originalThis: this });
        } as Fn;
      }
    } as Factories<Obj>);
  }

  /**
   * Registers a patch using raw factories (advanced API).
   *
   * @typeParam Obj - The object to patch.
   * @param obj - The object to patch.
   * @param factories - The factories to apply to the object.
   */
  public registerPatch<Obj extends object>(obj: Obj, factories: Factories<Obj>): void {
    const uninstaller = around(obj, factories);
    this.register(uninstaller);
  }
}

/**
 * Applies a patch to the object.
 * Better strongly-typed version of `monkey-around`.
 *
 * @typeParam Obj - The object to patch.
 * @param obj - The object to patch.
 * @param factories - The factories to apply to the object.
 * @returns The uninstaller that removes the patch when called.
 */
export function around<Obj extends object>(obj: Obj, factories: Factories<Obj>): Uninstaller {
  return originalAround(obj as GenericObject, factories as OriginalFactories<GenericObject>);
}

/**
 * Invokes a function with a patch applied to the object.
 * A patch is automatically removed when the function returns.
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
 * A patch is automatically removed when the function returns.
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
 * Convenience: creates a {@link MonkeyAroundComponent}, adds it as a child of the given component, and registers a method patch.
 *
 * @typeParam Obj - The object to patch.
 * @typeParam K - The method name to patch.
 * @param component - The parent component for lifecycle management.
 * @param obj - The object to patch.
 * @param methodName - The name of the method to patch.
 * @param handler - The patch handler function.
 * @returns The monkey-around component.
 */
export function registerMethodPatch<Obj extends object, K extends MethodKeys<Obj>>(
  component: Component,
  obj: Obj,
  methodName: K,
  handler: PatchHandlerFn<Obj, K>
): MonkeyAroundComponent {
  const monkeyAround = component.addChild(new MonkeyAroundComponent());
  monkeyAround.registerMethodPatch(obj, methodName, handler);
  return monkeyAround;
}

/**
 * Convenience: creates a {@link MonkeyAroundComponent}, adds it as a child of the given component, and registers a patch.
 *
 * @typeParam Obj - The object to patch.
 * @param component - The parent component for lifecycle management.
 * @param obj - The object to patch.
 * @param factories - The factories to apply to the object.
 * @returns The monkey-around component.
 */
export function registerPatch<Obj extends object>(component: Component, obj: Obj, factories: Factories<Obj>): MonkeyAroundComponent {
  const monkeyAround = component.addChild(new MonkeyAroundComponent());
  monkeyAround.registerPatch(obj, factories);
  return monkeyAround;
}
