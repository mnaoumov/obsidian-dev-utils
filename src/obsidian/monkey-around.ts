/**
 * @file
 *
 * Improved type-safe wrapper of {@link https://www.npmjs.com/package/monkey-around} library.
 */

import type { ConditionalKeys } from 'type-fest';

import { around as originalAround } from 'monkey-around';
import { Component } from 'obsidian';

import type { GenericObject } from '../type-guards.ts';

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
 * A component that applies a patch to an object during its lifecycle.
 * The patch is automatically installed when the component loads and removed when it unloads.
 *
 * @typeParam Obj - The object to patch.
 */
export class PatchComponent<Obj extends object> extends Component {
  /**
   * Creates a new patch component.
   *
   * @param obj - The object to patch.
   * @param factories - The factories to apply to the object.
   */
  public constructor(private readonly obj: Obj, private readonly factories: Factories<Obj>) {
    super();
  }

  /**
   * Installs the patch when the component loads.
   */
  public override onload(): void {
    super.onload();
    const uninstaller = around(this.obj, this.factories);
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
 * Registers a method patch using a simplified handler that receives `originalFn`, `originalThis`, and `originalArgs`.
 *
 * @typeParam Obj - The object to patch.
 * @typeParam K - The method name to patch.
 * @param component - The component to register the patch to.
 * @param obj - The object to patch.
 * @param methodName - The name of the method to patch.
 * @param handler - The patch handler function.
 * @returns The patch component.
 */
export function registerMethodPatch<Obj extends object, K extends MethodKeys<Obj>>(
  component: Component,
  obj: Obj,
  methodName: K,
  handler: PatchHandlerFn<Obj, K>
): PatchComponent<Obj> {
  type Fn = Extract<Obj[K], (...args: never[]) => unknown>;
  const factories = {
    [methodName]: (originalFn: Fn): Fn => {
      return function patchedMethod(this: Obj, ...originalArgs: Parameters<Fn>): ReturnType<Fn> {
        return handler({ originalArgs, originalFn, originalThis: this });
      } as Fn;
    }
  } as Factories<Obj>;
  return component.addChild(new PatchComponent<Obj>(obj, factories));
}

/**
 * Registers a patch to the object.
 *
 * @typeParam Obj - The object to patch.
 * @param component - The component to register the patch to.
 * @param obj - The object to patch.
 * @param factories - The factories to apply to the object.
 * @returns The patch component.
 */
export function registerPatch<Obj extends object>(component: Component, obj: Obj, factories: Factories<Obj>): PatchComponent<Obj> {
  return component.addChild(new PatchComponent<Obj>(obj, factories));
}
