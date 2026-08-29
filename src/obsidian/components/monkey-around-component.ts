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

import { getObsidianDevUtilsState } from '../../obsidian-dev-utils-state.ts';
import { ComponentEx } from './component-ex.ts';

/**
 * A type of the factories to apply to the object.
 *
 * @typeParam $Object - The object to patch.
 */
export type Factories<$Object extends object> = Partial<FullFactories<$Object>>;

/**
 * Keys of `Obj` whose value is callable — a method, or a function-like object such as a `Debouncer`. These are the members
 * accepted by {@link MonkeyAroundComponent#registerFunctionPatch}.
 *
 * @typeParam $Object - The object whose keys are filtered.
 */
export type FunctionKeys<$Object extends object> = ConditionalKeys<$Object, GenericFunction | undefined> & keyof $Object;

/**
 * Keys of `Obj` whose value is a plain function (a "real method"). Function-like objects that carry extra members are
 * excluded — e.g. a `Debouncer` (which adds `cancel`/`run`) belongs to {@link MonkeyAroundComponent#registerFunctionPatch},
 * not {@link MonkeyAroundComponent#registerMethodPatch}. The check is whether the member has any own keys beyond a bare
 * function's (`Exclude<keyof T, keyof GenericFunction>` is `never`).
 *
 * @typeParam $Object - The object whose keys are filtered.
 */
export type MethodKeys<$Object extends object> = MethodKeysMap<$Object>[FunctionKeys<$Object>];

/**
 * Parameters passed to {@link MonkeyAroundComponent#registerFunctionPatch}.
 *
 * @typeParam $Object - The object to patch.
 * @typeParam FunctionName - The function name to patch.
 */
export interface MonkeyAroundComponentRegisterFunctionPatchParams<$Object extends object, FunctionName extends FunctionKeys<$Object>> {
  /**
   * The object to patch.
   */
  readonly $object: $Object;

  /**
   * The function name to patch.
   */
  readonly functionName: FunctionName;

  /**
   * When `true`, the patch uninstalls itself the first time the patched function is invoked (by
   * unloading this component), restoring the original — so the interception happens exactly once.
   * Intended for a component dedicated to this single patch. Existing callers that omit it are
   * unaffected.
   *
   * @default `false`
   */
  readonly once?: boolean;

  /**
   * Patch handler function that takes the original value and returns the patched value.
   *
   * @param originalValue - The original value of the function.
   * @returns The patched value of the function.
   */
  patchHandler(originalValue: $Object[FunctionName]): $Object[FunctionName];
}

/**
 * Parameters passed to {@link MonkeyAroundComponent#registerMethodPatch}.
 *
 * @typeParam $Object - The object to patch.
 * @typeParam MethodName - The method name to patch.
 */
export interface MonkeyAroundComponentRegisterMethodPatchParams<$Object extends object, MethodName extends MethodKeys<$Object>> {
  /**
   * The object to patch.
   */
  readonly $object: $Object;

  /**
   * The method name to patch.
   */
  readonly methodName: MethodName;

  /**
   * When `true`, the patch uninstalls itself the first time the patched method is invoked, restoring
   * the original — so the interception happens exactly once. Existing callers that omit it are
   * unaffected.
   *
   * @default `false`
   */
  readonly once?: boolean;

  /**
   * The patch handler function.
   */
  readonly patchHandler: PatchHandlerFunction<$Object, MethodName>;

  /**
   * An optional token to identify the patch.
   *
   * The token is recorded against the method this patch INSTALLS, so the next patch of the same method
   * detects it via {@link hasPatchToken} on its own `originalMethod` and can defer to this one. The
   * patch that installs a token therefore never sees its own token — only the patches stacked on top of
   * it do. Use a `Symbol.for` token to make the detection work across independently bundled copies of
   * this library.
   *
   * The token is dropped when this component unloads, so a later patch that had deferred takes over on
   * its next call.
   */
  readonly patchToken?: symbol;

  /**
   * An optional post-patch handler function that runs after the patch is applied.
   */
  readonly postPatchHandler?: PostPatchHandlerFunction<$Object, MethodName>;
}

/**
 * A patch handler function that intercepts calls to a method on an object.
 *
 * @typeParam $Object - The object being patched.
 * @typeParam MethodName - The method name being patched.
 */
export type PatchHandlerFunction<$Object extends object, MethodName extends MethodKeys<$Object>> = (
  params: PatchHandlerParams<$Object, MethodName>
) => ReturnType<ExtractFunction<$Object, MethodName>>;

/**
 * Parameters passed to a {@link PatchHandlerFunction} callback.
 *
 * @typeParam $Object - The object being patched.
 * @typeParam MethodName - The method name being patched.
 */
export interface PatchHandlerParams<$Object extends object, MethodName extends MethodKeys<$Object>> {
  /**
   * Invokes the original method with the original `this` and arguments.
   *
   * @returns Whatever the original method returns.
   */
  fallback(this: void): ReturnType<ExtractFunction<$Object, MethodName>>;

  /**
   * The original arguments of the intercepted call, as a tuple.
   */
  readonly originalArguments: Parameters<ExtractFunction<$Object, MethodName>>;

  /**
   * The original (unpatched) method. Call via `originalFn.call(originalThis, ...originalArgs)`.
   */
  readonly originalMethod: ExtractFunction<$Object, MethodName>;

  /**
   * The original method, but with the `this` context already bound to the original object. Call via `originalMethodBound(...originalArgs)`.
   */
  readonly originalMethodBound: OmitThisParameter<ExtractFunction<$Object, MethodName>>;

  /**
   * The original `this` context of the intercepted call.
   */
  readonly originalThis: $Object;
}

/**
 * A post-patch handler function that runs after a patch is applied.
 *
 * @typeParam $Object - The object being patched.
 * @typeParam MethodName - The method name being patched.
 */
export type PostPatchHandlerFunction<$Object extends object, MethodName extends MethodKeys<$Object>> = (
  params: PostPatchHandlerParams<$Object, MethodName>
) => MaybeReturn<ExtractFunction<$Object, MethodName>>;

/**
 * Parameters passed to a {@link PostPatchHandlerFunction} callback.
 *
 * @typeParam $Object - The object being patched.
 * @typeParam MethodName - The method name being patched.
 */
export interface PostPatchHandlerParams<$Object extends object, MethodName extends MethodKeys<$Object>> {
  /**
   * The original (unpatched) method. Call via `originalFn.call(originalThis, ...originalArgs)`.
   */
  readonly originalMethod: ExtractFunction<$Object, MethodName>;

  /**
   * The patched method.
   */
  readonly patchedMethod: ExtractFunction<$Object, MethodName>;
}

type ExtractFunction<$Object extends object, MethodName extends MethodKeys<$Object>> = GenericFunction<Parameters<Extract<$Object[MethodName], GenericFunction>>, ReturnType<Extract<$Object[MethodName], GenericFunction>>>;

type FullFactories<$Object extends object> = {
  [Key in keyof $Object]: (originalValue: $Object[Key]) => $Object[Key];
};

type MethodKeysMap<$Object extends object> = {
  [Key in FunctionKeys<$Object>]: [Exclude<keyof NonNullable<$Object[Key]>, keyof GenericFunction>] extends [never] ? Key : never;
};

type OriginalFactories<$Object extends GenericObject> = Parameters<typeof originalAround<$Object>>[1];

type Uninstaller = () => void;

/**
 * A component that manages monkey-patches with lifecycle-bound cleanup.
 * All patches registered via this component are automatically uninstalled when the component unloads.
 */
export class MonkeyAroundComponent extends ComponentEx {
  /**
   * Registers a patch for a single function-like member (a method, or a callable such as a `Debouncer`) using a simplified handler.
   *
   * @typeParam $Object - The object to patch.
   * @typeParam FunctionName - The function name to patch.
   * @param params - The parameters of the patch.
   */
  public registerFunctionPatch<$Object extends object, const FunctionName extends FunctionKeys<$Object>>(
    params: MonkeyAroundComponentRegisterFunctionPatchParams<$Object, FunctionName>
  ): void {
    this.ensureLoaded();

    const factories: Factories<$Object> = {};
    // eslint-disable-next-line unicorn/no-immediate-mutation -- A computed key in an object literal does not match `Partial<FullFactories<$Object>>` when the key type is generic; assigning after declaration keeps the target type known.
    factories[params.functionName] = (originalValue: $Object[FunctionName]): $Object[FunctionName] => {
      const patchedValue = params.patchHandler(originalValue);
      if (!params.once) {
        return patchedValue;
      }

      // A `once` patch unloads this component after the first invocation — running the registered
      // Uninstaller and restoring the original. `unloadComponent` is an arrow so it captures the
      // Component `this`; the nested `oncePatchedValue` must be a function to receive the call-time
      // `this`. Own members (e.g. a `Debouncer`'s `cancel`/`run`) are copied onto it so function-like
      // Values keep working.
      const unloadComponent = (): void => {
        this.unload();
      };
      function oncePatchedValue(this: unknown, ...$arguments: unknown[]): unknown {
        try {
          return Reflect.apply(patchedValue, this, $arguments);
        } finally {
          unloadComponent();
        }
      }
      return Object.assign(oncePatchedValue, patchedValue) as $Object[FunctionName];
    };

    this.registerPatch(params.$object, factories);
  }

  /**
   * Registers a single-method patch using a simplified handler.
   *
   * @typeParam $Object - The object to patch.
   * @typeParam MethodName - The method name to patch.
   * @param params - The parameters of the patch.
   */
  public registerMethodPatch<$Object extends object, const MethodName extends MethodKeys<$Object>>(
    params: MonkeyAroundComponentRegisterMethodPatchParams<$Object, MethodName>
  ): void {
    this.ensureLoaded();

    type $Function = ExtractFunction<$Object, MethodName>;

    this.registerFunctionPatch({
      $object: params.$object,
      functionName: params.methodName,
      once: params.once ?? false,
      patchHandler: (originalMethodRaw) => {
        const originalMethod = originalMethodRaw as $Function;
        const finalPatchedMethod = params.postPatchHandler?.({
          originalMethod,
          patchedMethod
        }) ?? patchedMethod;
        return finalPatchedMethod as $Object[MethodName];

        function patchedMethod(this: $Object, ...originalArguments: Parameters<$Function>): ReturnType<$Function> {
          // eslint-disable-next-line consistent-this, @typescript-eslint/no-this-alias, unicorn/no-this-assignment -- We need to use the `this` context.
          const originalThis = this;
          return params.patchHandler({
            fallback() {
              return originalMethod.call(originalThis, ...originalArguments);
            },
            originalArguments,
            originalMethod,
            originalMethodBound: originalMethod.bind(originalThis),
            originalThis
          });
        }
      }
    });

    if (!params.patchToken) {
      return;
    }

    // The token marks the INSTALLED method, read back once the patch is in place.
    // That is the identity the next patch of the same method receives as its `originalMethod`.
    // `monkey-around` installs a wrapper of its own and exposes the value built above only via its prototype.
    // Marking that value, or the method being wrapped as this once did, matches nothing the next patch sees.
    // Dropping the token on unload lets a deferring later patch take over, since the guard is read per call.
    const patchedMethod = params.$object[params.methodName] as GenericFunction;
    const monkeyAroundPatches = getMonkeyAroundPatches();
    monkeyAroundPatches.set(patchedMethod, params.patchToken);
    this.register(() => {
      monkeyAroundPatches.delete(patchedMethod);
    });
  }

  /**
   * Registers a patch using raw factories (advanced API).
   *
   * @typeParam $Object - The object to patch.
   * @param $object - The object to patch.
   * @param factories - The factories to apply to the object.
   */
  public registerPatch<$Object extends object>($object: $Object, factories: Factories<$Object>): void {
    this.ensureLoaded();

    const uninstaller = around($object, factories);
    this.register(uninstaller);
  }
}

/**
 * Applies a patch to the object.
 * Better strongly-typed version of `monkey-around`.
 *
 * @typeParam $Object - The object to patch.
 * @param $object - The object to patch.
 * @param factories - The factories to apply to the object.
 * @returns The uninstaller that removes the patch when called.
 */
export function around<$Object extends object>($object: $Object, factories: Factories<$Object>): Uninstaller {
  return originalAround($object as GenericObject, factories as OriginalFactories<GenericObject>);
}

/**
 * Checks if a function has a specific patch token.
 *
 * A token is carried by the method a {@link MonkeyAroundComponent#registerMethodPatch} call INSTALLED, so
 * the intended caller is a later patch of the same method, checking the `originalMethod` it wrapped in
 * order to defer to the patch already in place:
 *
 * ```ts
 * patchHandler: ({ fallback, originalMethod }) => {
 *   if (hasPatchToken(originalMethod, PATCH_TOKEN)) {
 *     return fallback();
 *   }
 *   ...
 * }
 * ```
 *
 * The check is made per call, so it stops reporting the earlier patch once that patch's component unloads.
 *
 * @param $function - The function to check.
 * @param patchToken - The patch token to check for.
 * @returns Whether the function has the patch token.
 */
export function hasPatchToken($function: GenericFunction, patchToken: symbol): boolean {
  return getMonkeyAroundPatches().get($function) === patchToken;
}

function getMonkeyAroundPatches(): WeakMap<GenericFunction, symbol> {
  return getObsidianDevUtilsState('monkeyAroundPatches', new WeakMap<GenericFunction, symbol>()).value;
}
