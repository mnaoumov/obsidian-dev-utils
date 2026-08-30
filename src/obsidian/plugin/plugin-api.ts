/**
 * @file
 *
 * A typed, versioned, lifecycle-aware registry for cross-plugin APIs — the advanced successor to
 * `@vanakat/plugin-api`.
 *
 * A provider publishes its API once, under a contract version that is independent of its plugin version:
 *
 * ```ts
 * publishPluginApi({
 *   api: new MyApi(this),
 *   apiVersion: '2.1.0',
 *   contract: MY_API_CONTRACT_V2,
 *   plugin: this
 * });
 * ```
 *
 * A consumer gets a LIVE REF whose {@link PluginApiRef.value} is always current — `null` before the
 * provider loads, the API once it publishes, `null` again once it unloads, and the API again after a
 * re-enable:
 *
 * ```ts
 * const ref = watchPluginApi<MyApi>({
 *   apiVersionRange: '^2',
 *   app: this.app,
 *   component: this,
 *   pluginId: 'my-provider'
 * });
 *
 * ref.value;                    // MyApi | null — sync, free, always correct
 * await ref.whenAvailable();    // one-shot flows; rejects with a typed, classified error
 * ref.on('change', () => { }); // for consumers that must REACT rather than read
 * ```
 *
 * What this fixes, relative to publishing a bare object on `window.PluginApi`:
 *
 * - **Load order.** The ref subscribes; it does not sample. Reading `null` during `onload` means "not yet",
 *   and it becomes non-`null` on its own.
 * - **Version negotiation.** The provider declares a contract version; the consumer declares the range it
 *   compiled against; the highest satisfying record wins.
 * - **Stale handles.** The value is a revocable handle — after the provider unloads, a property read throws
 *   a {@link PluginApiRevokedError} naming the provider instead of a null deref deep in someone else's stack.
 * - **Free-string names.** Records are keyed by `plugin.manifest.id`, which Obsidian already keeps unique.
 * - **Legible failure.** {@link PluginApiRef.whenAvailable} rejects with a
 *   {@link PluginApiUnavailableError} carrying a {@link PluginApiUnavailabilityReason}, so the five distinct
 *   causes are told apart.
 *
 * Payload validation is opt-in per method through {@link https://standardschema.dev | Standard Schema}, so
 * zod / valibot / arktype / a hand-written validator all plug in and none of them is a dependency here. It
 * runs only while the `obsidian-dev-utils:PluginApi` debugger is enabled, so production pays nothing.
 *
 * @remarks
 * Every plugin bundles its OWN copy of `obsidian-dev-utils`, so a registry record is a wire format between
 * different library versions and must stay backward-compatible forever. Nothing crossing it may be
 * `instanceof`-checked — reads are structural, and only plain data objects and plain functions are stored.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec';
import type {
  App,
  Component,
  Plugin
} from 'obsidian';

import {
  compareVersions,
  satisfies as satisfiesVersion
} from 'compare-versions';

import type { AsyncEventSource } from '../../async-events.ts';

import { snapshot } from '../../array.ts';
import { mixinAsyncEvents } from '../../async-events.ts';
import {
  invokeAsyncSafely,
  runWithTimeout
} from '../../async.ts';
import { getLibDebugger } from '../../debug.ts';
import { castTo } from '../../object-utils.ts';
import { getObsidianDevUtilsState } from '../../obsidian-dev-utils-state.ts';

const PLUGIN_API_DEBUGGER_NAMESPACE = 'PluginApi';
const PLUGIN_API_REGISTRY_STATE_KEY = 'pluginApiRegistry';

/**
 * How long {@link PluginApiRef.whenAvailable} waits before giving up and classifying the failure.
 */
const DEFAULT_WHEN_AVAILABLE_TIMEOUT_IN_MILLISECONDS = 10_000;

/**
 * Which half of a method call a validation failure came from.
 */
export enum PluginApiPayloadKind {
  /**
   * The method's arguments.
   */
  Input = 'input',

  /**
   * The method's return value.
   */
  Output = 'output'
}

/**
 * The reason a plugin API could not be handed over.
 *
 * The whole point of the enum is that the five failures below are told apart: `@vanakat/plugin-api` collapses
 * all of them into a `Notice` plus `undefined`.
 */
export enum PluginApiUnavailabilityReason {
  /**
   * The plugin is installed but not enabled.
   */
  NotEnabled = 'notEnabled',

  /**
   * The plugin is not installed in this vault.
   */
  NotInstalled = 'notInstalled',

  /**
   * The plugin is installed and enabled but has not published any API.
   */
  NotPublished = 'notPublished',

  /**
   * The handle was valid but the provider has since unloaded, so it has been revoked.
   */
  Revoked = 'revoked',

  /**
   * A record satisfies the requested version range, but the API object is missing a method the contract
   * declares — the provider's shipped shape and its declared shape disagree.
   */
  ShapeMismatch = 'shapeMismatch',

  /**
   * The plugin published an API, but no published contract version satisfies the requested range.
   */
  VersionMismatch = 'versionMismatch'
}

/**
 * The contract a provider declares for its API: every key is a method the API is promising to expose, and
 * its value optionally carries the payload schemas for that method.
 *
 * The KEYS are the part that always matters — they drive the shape check that decides whether a published
 * record is usable at all. The schemas are optional and only ever consulted while debugging.
 *
 * @remarks
 * Why the shape check is a `typeof` rather than a schema over the whole API object. In zod 4 `z.function()`
 * returns a function FACTORY, not a schema, so it cannot be a `z.object()` member directly. There is a known
 * workaround (zod#4143) — `z.custom((fn) => functionSchema.implement(fn))` — and it does buy correct
 * `z.infer` types for a function member. It does not buy runtime validation here, though: `z.custom` is a
 * boolean predicate that returns its input unchanged, so the validating wrapper `implement` builds is
 * discarded and the check collapses back to "is it callable". Keeping that wrapper would need a further
 * `.transform()`, and would then move validation onto every call instead of behind the debug gate, and bind
 * the contract to zod specifically — which is exactly what reaching through Standard Schema avoids. So the
 * declared method names are checked with `typeof`, and the payloads are validated per method instead.
 */
export type PluginApiContract = Record<string, PluginApiMethodContract>;

/**
 * The payload schemas for a single API method. Both halves are optional: a method may declare only its input,
 * only its output, neither (the entry then just declares that the method must exist), or both.
 */
export interface PluginApiMethodContract {
  /**
   * Validates the method's arguments, as an array.
   */
  readonly input?: StandardSchemaV1;

  /**
   * Validates the method's return value — or, when the method returns a thenable, the value it resolves to.
   */
  readonly output?: StandardSchemaV1;
}

/**
 * A live reference to another plugin's API.
 *
 * @typeParam TApi - The API type the consumer compiled against.
 *
 * @remarks
 * The ref is the WHOLE consumer surface, deliberately. A plain {@link Promise} cannot model this because it
 * settles once, whereas availability is a repeating signal (available → gone → available again across a
 * disable/enable cycle) — which is why {@link PluginApiRef.whenAvailable} is a method ON the ref rather than
 * the thing handed back. The `change` event exists for consumers that must react rather than read, and is
 * secondary: it imposes no ceremony on the common case, which is reading {@link PluginApiRef.value}.
 */
export interface PluginApiRef<TApi extends object> extends AsyncEventSource<PluginApiRefEventMap> {
  /**
   * The API, or `null` when it is not currently available.
   *
   * Always current, synchronous, and free — the ref maintains it, so there is no registry lookup per read.
   * `null` here means "not available right now", NOT "not installed": during a consumer's `onload` the
   * provider may simply not have loaded yet, and the value becomes non-`null` on its own.
   */
  readonly value: null | TApi;

  /**
   * Waits for the API to become available.
   *
   * @param options - The options for the wait.
   * @returns A {@link Promise} that resolves with the API.
   * @throws A {@link PluginApiUnavailableError} whose {@link PluginApiUnavailableError.reason} says which of
   * the five failures occurred, if the API does not become available before the timeout elapses.
   */
  whenAvailable(options?: WhenAvailablePluginApiOptions): Promise<TApi>;
}

/**
 * The events a {@link PluginApiRef} fires.
 */
export interface PluginApiRefEventMap {
  /**
   * Fired whenever {@link PluginApiRef.value} changes — including when it becomes `null` because the provider
   * unloaded.
   */
  change: [];
}

/**
 * Parameters for the {@link PluginApiUnavailableError} constructor.
 */
export interface PluginApiUnavailableErrorConstructorParams {
  /**
   * An explicit message. When omitted, one is derived from the plugin id and the reason.
   */
  readonly message?: string;

  /**
   * The `manifest.id` of the plugin whose API was requested.
   */
  readonly pluginId: string;

  /**
   * Which of the five failures occurred.
   */
  readonly reason: PluginApiUnavailabilityReason;
}

/**
 * Parameters for the {@link PluginApiValidationError} constructor.
 */
export interface PluginApiValidationErrorConstructorParams {
  /**
   * The issues the schema reported.
   */
  readonly issues: readonly StandardSchemaV1.Issue[];

  /**
   * The name of the method whose payload failed validation.
   */
  readonly methodName: string;

  /**
   * Whether the input or the output failed.
   */
  readonly payloadKind: PluginApiPayloadKind;

  /**
   * The `manifest.id` of the providing plugin.
   */
  readonly pluginId: string;
}

/**
 * Parameters for {@link publishPluginApi}.
 *
 * @typeParam TApi - The API type being published.
 */
export interface PublishPluginApiParams<TApi extends object> {
  /**
   * The API object to publish. Its methods are handed to consumers through a revocable handle, and they are
   * always invoked with this object as their `this`, so an implementation using private class fields keeps
   * working.
   */
  readonly api: TApi;

  /**
   * The CONTRACT version, in semver form — independent of the plugin's own version. Plugin `1.4.7` may
   * perfectly well expose API `2.0.0`.
   */
  readonly apiVersion: string;

  /**
   * The contract this version of the API satisfies. Optional: when omitted, no shape check is performed on
   * the provider's behalf and the consumer's own contract (if any) is used instead.
   */
  readonly contract?: PluginApiContract;

  /**
   * The publishing plugin. The record is keyed by its `manifest.id` and revoked automatically when the plugin
   * unloads, via `plugin.register()`.
   */
  readonly plugin: Plugin;
}

/**
 * Parameters for {@link watchPluginApi}.
 */
export interface WatchPluginApiParams {
  /**
   * The semver range of contract versions the consumer compiled against, e.g. `'^2'`. The highest published
   * version satisfying it wins.
   *
   * @remarks
   * The range is evaluated by `compare-versions`, which accepts `^`, `~`, comparison operators, and `x`
   * wildcards — but NOT a bare `*`. Spell "any version" as `'>=0.0.0'`.
   */
  readonly apiVersionRange: string;

  /**
   * The Obsidian app instance, used to classify a failure as not-installed vs not-enabled.
   */
  readonly app: App;

  /**
   * The component owning the subscription. The watch is torn down when it unloads.
   */
  readonly component: Component;

  /**
   * The contract the CONSUMER expects. Optional, and it wins over the provider's published contract when
   * supplied — it is the consumer's own compiled-against expectation, so it is the one whose violation is
   * the consumer's problem.
   */
  readonly contract?: PluginApiContract;

  /**
   * The `manifest.id` of the providing plugin.
   */
  readonly pluginId: string;
}

/**
 * Options for {@link PluginApiRef.whenAvailable}.
 */
export interface WhenAvailablePluginApiOptions {
  /**
   * How long to wait before giving up and classifying the failure.
   *
   * @default 10000
   */
  readonly timeoutInMilliseconds?: number;
}

/**
 * Parameters for {@link createMethodWrapper}.
 */
interface CreateMethodWrapperParams {
  readonly methodContract: PluginApiMethodContract | undefined;

  /**
   * The human-readable name used in error messages and debug output. NOT a key — see {@link propertyKey}.
   */
  readonly methodName: string;

  readonly pluginId: string;

  /**
   * The key the method is actually read by, which may be a symbol.
   */
  readonly propertyKey: PropertyKey;

  readonly target: object;
}

/**
 * The realm-global registry shared by every `obsidian-dev-utils` copy in the renderer.
 */
interface PluginApiRegistry {
  records: Record<string, PublishedPluginApiRecord[]>;
  subscribers: (() => void)[];
}

/**
 * A record as it sits in the shared registry.
 *
 * @remarks
 * This is the WIRE FORMAT between different `obsidian-dev-utils` copies, so it holds nothing but plain data
 * and plain functions, and every read of it elsewhere in this file is structural.
 */
interface PublishedPluginApiRecord {
  api: object;
  apiVersion: string;
  contract: PluginApiContract;
  isRevoked: boolean;
  pluginId: string;
}

/**
 * Parameters for {@link validatePayload}.
 */
interface ValidatePayloadParams {
  readonly methodName: string;
  readonly payloadKind: PluginApiPayloadKind;
  readonly pluginId: string;
  readonly schema: StandardSchemaV1;
  readonly value: unknown;
}

/**
 * Holds what a watch needs regardless of the API type it is typed against, so the {@link mixinAsyncEvents}
 * mixin has a real base to extend.
 */
abstract class PluginApiWatchBase {
  protected handle: null | object = null;

  protected record: null | PublishedPluginApiRecord = null;

  // A `protected` constructor is not assignable to `AbstractConstructor<object>`, which is what
  // `mixinAsyncEvents` accepts, so this stays public even though only the subclass below calls it.
  public constructor(protected readonly params: WatchPluginApiParams) {}

  /**
   * Builds the error describing why the API is not available right now.
   *
   * @returns The classified error.
   */
  protected createUnavailableError(): PluginApiUnavailableError {
    return new PluginApiUnavailableError({
      pluginId: this.params.pluginId,
      reason: resolveUnavailabilityReason(this.params)
    });
  }
}

class PluginApiRefImpl<TApi extends object> extends mixinAsyncEvents<PluginApiRefEventMap>()(PluginApiWatchBase) implements PluginApiRef<TApi> {
  public get value(): null | TApi {
    return castTo<null | TApi>(this.handle);
  }

  public constructor(params: WatchPluginApiParams) {
    super(params);
  }

  /**
   * Recomputes the current value from the registry, firing `change` only when it actually changed.
   */
  public refresh(): void {
    const record = selectRecord(this.params);
    if (record === this.record) {
      return;
    }

    this.record = record;
    this.handle = record === null ? null : createRevocableHandle(record, this.params.contract);
    this.trigger('change');
  }

  public async whenAvailable(options?: WhenAvailablePluginApiOptions): Promise<TApi> {
    const currentValue = this.value;
    if (currentValue !== null) {
      return currentValue;
    }

    try {
      return await runWithTimeout<TApi>({
        operationFunction: async (abortSignal: AbortSignal): Promise<TApi> => await this.waitForValue(abortSignal),
        operationName: `watchPluginApi("${this.params.pluginId}").whenAvailable`,
        timeoutInMilliseconds: options?.timeoutInMilliseconds ?? DEFAULT_WHEN_AVAILABLE_TIMEOUT_IN_MILLISECONDS
      });
    } catch {
      throw this.createUnavailableError();
    }
  }

  private async waitForValue(abortSignal: AbortSignal): Promise<TApi> {
    return await new Promise<TApi>((resolve, reject) => {
      // The listener is registered FIRST and invoked through a thunk, so `eventRef` is already bound by the
      // Time anything can reach it — which is what lets `cleanUp` be unconditional rather than null-guarded.
      const eventRef = this.on('change', () => {
        handleChange();
      });

      function cleanUp(): void {
        eventRef.asyncEventSource.offref(eventRef);
        abortSignal.removeEventListener('abort', handleAbort);
      }

      function handleAbort(): void {
        cleanUp();
        reject(abortSignal.reason as Error);
      }

      const handleChange = (): void => {
        const value = this.value;
        if (value !== null) {
          cleanUp();
          resolve(value);
        }
      };

      abortSignal.addEventListener('abort', handleAbort);
      handleChange();
    });
  }
}

/**
 * Thrown when a plugin API cannot be handed over, carrying the {@link PluginApiUnavailabilityReason} that says
 * why.
 */
export class PluginApiUnavailableError extends Error {
  /**
   * The `manifest.id` of the plugin whose API was requested.
   */
  public readonly pluginId: string;

  /**
   * Which of the five failures occurred.
   */
  public readonly reason: PluginApiUnavailabilityReason;

  /**
   * Creates a {@link PluginApiUnavailableError}.
   *
   * @param params - The parameters for the error.
   */
  public constructor(params: PluginApiUnavailableErrorConstructorParams) {
    super(params.message ?? `The API of the plugin "${params.pluginId}" is unavailable: ${params.reason}.`);
    this.name = 'PluginApiUnavailableError';
    this.pluginId = params.pluginId;
    this.reason = params.reason;
  }
}

/**
 * Thrown when a property is read from a handle whose provider has since unloaded.
 *
 * This is the point of handing out a revocable handle rather than the raw object: a consumer that cached the
 * API in a field and kept using it across a disable gets an error naming the provider, instead of
 * `Cannot read properties of undefined` somewhere deep inside a torn-down plugin.
 */
export class PluginApiRevokedError extends PluginApiUnavailableError {
  /**
   * Creates a {@link PluginApiRevokedError}.
   *
   * @param pluginId - The `manifest.id` of the plugin whose API was revoked.
   */
  public constructor(pluginId: string) {
    super({
      message: `The API of the plugin "${pluginId}" has been revoked, because the plugin was unloaded.`,
      pluginId,
      reason: PluginApiUnavailabilityReason.Revoked
    });
    this.name = 'PluginApiRevokedError';
  }
}

/**
 * Thrown when a published API's payload fails the schema its contract declares.
 *
 * Only ever thrown while the `obsidian-dev-utils:PluginApi` debugger is enabled — in production the methods
 * are not wrapped at all.
 */
export class PluginApiValidationError extends Error {
  /**
   * The issues the schema reported.
   */
  public readonly issues: readonly StandardSchemaV1.Issue[];

  /**
   * The name of the method whose payload failed validation.
   */
  public readonly methodName: string;

  /**
   * The `manifest.id` of the providing plugin.
   */
  public readonly pluginId: string;

  /**
   * Creates a {@link PluginApiValidationError}.
   *
   * @param params - The parameters for the error.
   */
  public constructor(params: PluginApiValidationErrorConstructorParams) {
    super(
      `The ${params.payloadKind} of "${params.pluginId}" API method "${params.methodName}" failed validation: ${formatIssues(params.issues)}`
    );
    this.name = 'PluginApiValidationError';
    this.issues = params.issues;
    this.methodName = params.methodName;
    this.pluginId = params.pluginId;
  }
}

/**
 * Publishes a plugin's API so other plugins can consume it, keyed by the plugin's `manifest.id` and revoked
 * automatically when the plugin unloads.
 *
 * Several contract versions may be published side by side, so a provider can move to `2.0.0` without breaking
 * consumers still pinned to `^1`.
 *
 * @typeParam TApi - The API type being published.
 * @param params - The parameters for publishing.
 * @throws An {@link Error} if this plugin has already published this exact `apiVersion`.
 */
export function publishPluginApi<TApi extends object>(params: PublishPluginApiParams<TApi>): void {
  const pluginId = params.plugin.manifest.id;
  const registry = getRegistry();
  const records = registry.records[pluginId] ?? [];
  registry.records[pluginId] = records;

  if (records.some((record) => record.apiVersion === params.apiVersion)) {
    throw new Error(`The plugin "${pluginId}" has already published the API version "${params.apiVersion}".`);
  }

  const record: PublishedPluginApiRecord = {
    api: params.api,
    apiVersion: params.apiVersion,
    contract: params.contract ?? {},
    isRevoked: false,
    pluginId
  };
  records.push(record);
  notifySubscribers();

  params.plugin.register(() => {
    revokeRecord(record);
  });
}

/**
 * Watches another plugin's API and returns a live {@link PluginApiRef} whose {@link PluginApiRef.value} stays
 * correct across the provider's load, unload, and re-enable.
 *
 * This is the entire consumer surface. There is deliberately no synchronous "get it or `null`" probe: a probe
 * only answers "now" and never tells you when "now" changed, so calling one during `onload` reads `null` and
 * invites the conclusion "not installed". A consumer that needs a synchronous answer inside a callback whose
 * signature forbids `await` — `checkCallback(isChecking): boolean`, `canExecute()`, a settings-row `visible`
 * predicate — holds the ref (or the value it maintains) in a field and reads that, which is both cheaper and
 * correct across BOTH edges.
 *
 * @typeParam TApi - The API type the consumer compiled against.
 * @param params - The parameters for the watch.
 * @returns The live reference.
 */
export function watchPluginApi<TApi extends object>(params: WatchPluginApiParams): PluginApiRef<TApi> {
  const ref = new PluginApiRefImpl<TApi>(params);
  const unsubscribe = subscribe(() => {
    ref.refresh();
  });
  params.component.register(unsubscribe);
  ref.refresh();
  return ref;
}

/**
 * Structurally detects a thenable. A cross-copy value may come from another realm, so `instanceof Promise` is
 * not usable here — the same discipline the registry records follow.
 *
 * @typeParam T - The value the thenable resolves to.
 * @param value - The value to test.
 * @returns `true` when the value is thenable.
 */
function checkIsPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return typeof value === 'object'
    && value !== null
    && 'then' in value
    && typeof (value as PromiseLike<T>).then === 'function';
}

/**
 * Checks that every method the effective contract declares is actually present on the published API.
 *
 * @param record - The published record.
 * @param consumerContract - The consumer's own contract, which wins when supplied.
 * @returns `true` when the shape matches.
 */
function checkMatchesContractShape(record: PublishedPluginApiRecord, consumerContract?: PluginApiContract): boolean {
  const contract = consumerContract ?? record.contract;
  return Object.keys(contract).every((methodName) => typeof getMember(record.api, methodName) === 'function');
}

/**
 * Builds the function a consumer actually calls: it always invokes the original with the raw API object as
 * `this`, and — only while the library debugger is enabled — validates the declared payloads around it.
 *
 * The debugger is consulted per call rather than per wrap, so toggling `DEBUG` at runtime takes effect without
 * re-acquiring the handle, while the wrapper's identity stays stable.
 *
 * @param params - The parameters for the wrapper.
 * @returns The wrapper function.
 */
function createMethodWrapper(params: CreateMethodWrapperParams): (...$arguments: unknown[]) => unknown {
  return function pluginApiMethod(...$arguments: unknown[]): unknown {
    // Read by the ORIGINAL key, not by the display name: `String(symbol)` is `'Symbol(x)'`, which is not a
    // Key the API object has.
    const method = castTo<(...$innerArguments: unknown[]) => unknown>(getMember(params.target, params.propertyKey));
    const methodContract = params.methodContract;

    if (methodContract === undefined || !getPluginApiDebugger().enabled) {
      return method.apply(params.target, $arguments);
    }

    if (methodContract.input) {
      validatePayload({
        methodName: params.methodName,
        payloadKind: PluginApiPayloadKind.Input,
        pluginId: params.pluginId,
        schema: methodContract.input,
        value: $arguments
      });
    }

    const returnValue = method.apply(params.target, $arguments);
    const outputSchema = methodContract.output;
    if (!outputSchema) {
      return returnValue;
    }

    if (checkIsPromiseLike(returnValue)) {
      return returnValue.then((resolvedValue: unknown) => {
        validatePayload({
          methodName: params.methodName,
          payloadKind: PluginApiPayloadKind.Output,
          pluginId: params.pluginId,
          schema: outputSchema,
          value: resolvedValue
        });
        return resolvedValue;
      });
    }

    validatePayload({
      methodName: params.methodName,
      payloadKind: PluginApiPayloadKind.Output,
      pluginId: params.pluginId,
      schema: outputSchema,
      value: returnValue
    });
    return returnValue;
  };
}

/**
 * Wraps a published API in a revocable handle.
 *
 * A flag-checking `get` trap is used rather than `Proxy.revocable`, because the latter throws a bare
 * `TypeError` whose message we cannot phrase — and the whole value of revoking is that the error names the
 * provider.
 *
 * Methods are bound to the RAW api object rather than to the proxy: an implementation using private class
 * fields (`#field`) throws if its `this` is a proxy.
 *
 * @param record - The published record.
 * @param consumerContract - The consumer's own contract, which wins over the published one when supplied.
 * @returns The handle.
 */
function createRevocableHandle(record: PublishedPluginApiRecord, consumerContract?: PluginApiContract): object {
  const contract = consumerContract ?? record.contract;
  const methodCache = new Map<PropertyKey>();

  return new Proxy(record.api, {
    get(target: object, propertyKey: PropertyKey): unknown {
      if (record.isRevoked) {
        throw new PluginApiRevokedError(record.pluginId);
      }

      const value = getMember(target, propertyKey);
      if (typeof value !== 'function') {
        return value;
      }

      let method = methodCache.get(propertyKey);
      if (method === undefined) {
        method = createMethodWrapper({
          methodContract: typeof propertyKey === 'string' ? contract[propertyKey] : undefined,
          methodName: String(propertyKey),
          pluginId: record.pluginId,
          propertyKey,
          target
        });
        methodCache.set(propertyKey, method);
      }
      return method;
    }
  });
}

/**
 * Renders schema issues into a single readable line.
 *
 * @param issues - The issues to render.
 * @returns The rendered message.
 */
function formatIssues(issues: readonly StandardSchemaV1.Issue[]): string {
  return issues
    .map((issue) => {
      const path = issue.path?.map((segment) => String(typeof segment === 'object' ? segment.key : segment)).join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

/**
 * Returns the records a plugin currently has published, excluding any that have been revoked.
 *
 * @param pluginId - The `manifest.id` of the providing plugin.
 * @returns The live records.
 */
function getLiveRecords(pluginId: string): PublishedPluginApiRecord[] {
  return (getRegistry().records[pluginId] ?? []).filter((record) => !record.isRevoked);
}

/**
 * Reads a member off a published API object without narrowing it — the API crosses a library-version boundary,
 * so nothing about its shape may be assumed.
 *
 * @param api - The published API object.
 * @param methodName - The member to read.
 * @returns The member's value.
 */
function getMember(api: object, methodName: PropertyKey): unknown {
  return Reflect.get(api, methodName);
}

/**
 * The debugger that gates payload validation.
 *
 * @returns The debugger.
 */
function getPluginApiDebugger(): ReturnType<typeof getLibDebugger> {
  return getLibDebugger(PLUGIN_API_DEBUGGER_NAMESPACE);
}

/**
 * Retrieves the shared registry, tolerating a bag written by a DIFFERENT `obsidian-dev-utils` copy that may
 * predate one of its fields.
 *
 * @returns The registry.
 */
function getRegistry(): PluginApiRegistry {
  const wrapper = getObsidianDevUtilsState<Partial<PluginApiRegistry>>(PLUGIN_API_REGISTRY_STATE_KEY, {});
  const registry = wrapper.value;
  registry.records ??= {};
  registry.subscribers ??= [];
  return castTo<PluginApiRegistry>(registry);
}

/**
 * Notifies every subscriber, over a SNAPSHOT of the list — a callback is free to unsubscribe (or subscribe)
 * while the sweep is running.
 */
function notifySubscribers(): void {
  for (const subscriber of snapshot(getRegistry().subscribers)) {
    subscriber();
  }
}

/**
 * Determines which of the five failures applies, probing the causes from the outermost inwards so the most
 * actionable one wins.
 *
 * @param params - The watch parameters.
 * @returns The reason.
 */
function resolveUnavailabilityReason(params: WatchPluginApiParams): PluginApiUnavailabilityReason {
  if (!Object.hasOwn(params.app.plugins.manifests, params.pluginId)) {
    return PluginApiUnavailabilityReason.NotInstalled;
  }

  if (!params.app.plugins.enabledPlugins.has(params.pluginId)) {
    return PluginApiUnavailabilityReason.NotEnabled;
  }

  const records = getLiveRecords(params.pluginId);
  if (records.length === 0) {
    return PluginApiUnavailabilityReason.NotPublished;
  }

  if (records.every((record) => !satisfiesVersion(record.apiVersion, params.apiVersionRange))) {
    return PluginApiUnavailabilityReason.VersionMismatch;
  }

  return PluginApiUnavailabilityReason.ShapeMismatch;
}

/**
 * Marks a record revoked and drops it from the registry, then tells every watcher to recompute.
 *
 * The record object itself is deliberately kept alive and flagged rather than discarded, because handles
 * already handed out close over it — that flag is what turns a later property read into a
 * {@link PluginApiRevokedError}.
 *
 * @param record - The record to revoke.
 */
function revokeRecord(record: PublishedPluginApiRecord): void {
  record.isRevoked = true;
  const registry = getRegistry();
  const records = registry.records[record.pluginId];
  if (records) {
    registry.records[record.pluginId] = records.filter((candidate) => candidate !== record);
  }
  notifySubscribers();
}

/**
 * Picks the highest published record that is live, satisfies the requested version range, and matches the
 * effective contract's shape.
 *
 * @param params - The watch parameters.
 * @returns The winning record, or `null` when none qualifies.
 */
function selectRecord(params: WatchPluginApiParams): null | PublishedPluginApiRecord {
  const candidates = getLiveRecords(params.pluginId)
    .filter((record) => satisfiesVersion(record.apiVersion, params.apiVersionRange))
    .filter((record) => checkMatchesContractShape(record, params.contract))
    .sort((a, b) => compareVersions(b.apiVersion, a.apiVersion));

  return candidates[0] ?? null;
}

/**
 * Registers a callback fired whenever the registry changes.
 *
 * @param subscriber - The callback.
 * @returns A function that unregisters the callback.
 */
function subscribe(subscriber: () => void): () => void {
  const registry = getRegistry();
  registry.subscribers.push(subscriber);
  return (): void => {
    const index = registry.subscribers.indexOf(subscriber);
    if (index !== -1) {
      registry.subscribers.splice(index, 1);
    }
  };
}

/**
 * Runs one Standard Schema over one payload.
 *
 * A schema that answers SYNCHRONOUSLY throws at the call site, which is the whole point — a version skew reads
 * as a legible error where the call was made. A schema that answers with a {@link Promise} cannot do that: the
 * synchronous call it was guarding has already returned by the time the answer arrives, so there is nothing to
 * throw into and the failure is reported through the library debugger instead.
 *
 * @param params - The parameters for the validation.
 * @throws A {@link PluginApiValidationError} if a synchronous schema reports issues.
 */
function validatePayload(params: ValidatePayloadParams): void {
  const result = params.schema['~standard'].validate(params.value);

  if (checkIsPromiseLike<StandardSchemaV1.Result<unknown>>(result)) {
    invokeAsyncSafely(async () => {
      const asyncResult = await result;
      if (asyncResult.issues) {
        getPluginApiDebugger()(
          'Asynchronous validation of the %s of "%s" API method "%s" failed: %s',
          params.payloadKind,
          params.pluginId,
          params.methodName,
          formatIssues(asyncResult.issues)
        );
      }
    });
    return;
  }

  if (result.issues) {
    throw new PluginApiValidationError({
      issues: result.issues,
      methodName: params.methodName,
      payloadKind: params.payloadKind,
      pluginId: params.pluginId
    });
  }
}
