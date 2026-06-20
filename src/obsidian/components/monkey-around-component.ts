/**
 * @file
 *
 * Improved type-safe wrapper of {@link https://www.npmjs.com/package/monkey-around} library.
 */

import type { ConditionalKeys } from 'type-fest';

import { around as originalAround } from 'monkey-around';

import type { GenericFunction } from '../../function.ts';
import type { GenericObject } from '../../type-guards.ts';
import type { MaybeReturn } from '../../type.ts';

import { getObsidianDevUtilsState } from '../app.ts';
import { ComponentEx } from './component-ex.ts';

/**
 * A type of the factories to apply to the object.
 *
 * @typeParam Obj - The object to patch.
 */
export type Factories<Obj extends object> = Partial<
  {
    [Key in ConditionalKeys<Obj, GenericFunction | undefined>]: WrapperFactory<Extract<Obj[Key], GenericFunction | undefined>>;
  }
>;

/**
 * Parameters passed to {@link MonkeyAroundComponent#registerMethodPatch}.
 *
 * @typeParam Obj - The object to patch.
 * @typeParam MethodName - The method name to patch.
 */
export interface MonkeyAroundComponentRegisterMethodPatchParams<Obj extends object, MethodName extends MethodKeys<Obj>> {
  /**
   * The method name to patch.
   */
  readonly methodName: MethodName;

  /**
   * The object to patch.
   */
  readonly obj: Obj;

  /**
   * The patch handler function.
   */
  readonly patchHandler: PatchHandlerFn<Obj, MethodName>;

  /**
   * An optional token to identify the patch.
   */
  readonly patchToken?: symbol;

  /**
   * An optional post-patch handler function that runs after the patch is applied.
   */
  readonly postPatchHandler?: PostPatchHandlerFn<Obj, MethodName>;
}

/**
 * A patch handler function that intercepts calls to a method on an object.
 *
 * @typeParam Obj - The object being patched.
 * @typeParam MethodName - The method name being patched.
 */
export type PatchHandlerFn<Obj extends object, MethodName extends MethodKeys<Obj>> = (
  params: PatchHandlerParams<Obj, MethodName>
) => ReturnType<ExtractFunction<Obj, MethodName>>;

/**
 * Parameters passed to a {@link PatchHandlerFn} callback.
 *
 * @typeParam Obj - The object being patched.
 * @typeParam MethodName - The method name being patched.
 */
export interface PatchHandlerParams<Obj extends object, MethodName extends MethodKeys<Obj>> {
  fallback(this: void): ReturnType<ExtractFunction<Obj, MethodName>>;

  /**
   * The original arguments of the intercepted call, as a tuple.
   */
  readonly originalArgs: Parameters<ExtractFunction<Obj, MethodName>>;

  /**
   * The original (unpatched) method. Call via `originalFn.call(originalThis, ...originalArgs)`.
   */
  readonly originalMethod: ExtractFunction<Obj, MethodName>;

  /**
   * The original method, but with the `this` context already bound to the original object. Call via `originalMethodBound(...originalArgs)`.
   */
  readonly originalMethodBound: OmitThisParameter<ExtractFunction<Obj, MethodName>>;

  /**
   * The original `this` context of the intercepted call.
   */
  readonly originalThis: Obj;
}

/**
 * A post-patch handler function that runs after a patch is applied.
 *
 * @typeParam Obj - The object being patched.
 * @typeParam MethodName - The method name being patched.
 */
export type PostPatchHandlerFn<Obj extends object, MethodName extends MethodKeys<Obj>> = (
  params: PostPatchHandlerParams<Obj, MethodName>
) => MaybeReturn<ExtractFunction<Obj, MethodName>>;

/**
 * Parameters passed to a {@link PostPatchHandlerFn} callback.
 *
 * @typeParam Obj - The object being patched.
 * @typeParam MethodName - The method name being patched.
 */
export interface PostPatchHandlerParams<Obj extends object, MethodName extends MethodKeys<Obj>> {
  /**
   * The original (unpatched) method. Call via `originalFn.call(originalThis, ...originalArgs)`.
   */
  readonly originalMethod: ExtractFunction<Obj, MethodName>;

  /**
   * The patched method.
   */
  readonly patchedMethod: ExtractFunction<Obj, MethodName>;
}

type ExtractFunction<Obj extends object, MethodName extends MethodKeys<Obj>> = GenericFunction<Parameters<Extract<Obj[MethodName], GenericFunction>>, ReturnType<Extract<Obj[MethodName], GenericFunction>>>;

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- We need to use `Function` type as a generic restriction.
type MethodKeys<Obj extends object> = ConditionalKeys<Obj, Function | undefined> & keyof Obj;

type OriginalFactories<Obj extends GenericObject> = Parameters<typeof originalAround<Obj>>[1];

type Uninstaller = () => void;

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- We need to use `Function` type as a generic restriction.
type WrapperFactory<T extends Function | undefined> = (next: T) => T;

/**
 * A component that manages monkey-patches with lifecycle-bound cleanup.
 * All patches registered via this component are automatically uninstalled when the component unloads.
 */
export class MonkeyAroundComponent extends ComponentEx {
  /**
   * Registers a single-method patch using a simplified handler.
   *
   * @typeParam Obj - The object to patch.
   * @typeParam MethodName - The method name to patch.
   * @param params - The parameters of the patch.
   */
  public registerMethodPatch<Obj extends object, const MethodName extends MethodKeys<Obj>>(
    params: MonkeyAroundComponentRegisterMethodPatchParams<Obj, MethodName>
  ): void {
    this.ensureLoaded();

    if (params.patchToken) {
      const originalMethod = params.obj[params.methodName] as GenericFunction;
      getMonkeyAroundPatches().set(originalMethod, params.patchToken);
    }

    type Fn = ExtractFunction<Obj, MethodName>;

    this.registerPatch(params.obj, {
      [params.methodName]: (originalMethod: Fn): Fn => {
        return params.postPatchHandler?.({
          originalMethod,
          patchedMethod
        }) ?? patchedMethod;
        function patchedMethod(this: Obj, ...originalArgs: Parameters<Fn>): ReturnType<Fn> {
          // eslint-disable-next-line consistent-this, @typescript-eslint/no-this-alias -- We need to use the `this` context.
          const originalThis = this;
          return params.patchHandler({
            fallback() {
              return originalMethod.call(originalThis, ...originalArgs);
            },
            originalArgs,
            originalMethod,
            originalMethodBound: originalMethod.bind(originalThis),
            originalThis
          });
        }
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
    this.ensureLoaded();

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
 * Checks if a function has a specific patch token.
 *
 * @param fn - The function to check.
 * @param patchToken - The patch token to check for.
 * @returns Whether the function has the patch token.
 */
export function hasPatchToken(fn: GenericFunction, patchToken: symbol): boolean {
  return getMonkeyAroundPatches().get(fn) === patchToken;
}

function getMonkeyAroundPatches(): WeakMap<GenericFunction, symbol> {
  return getObsidianDevUtilsState(null, 'monkeyAroundPatches', new WeakMap<GenericFunction, symbol>()).value;
}
