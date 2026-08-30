/**
 * @file
 *
 * Tests for the cross-plugin API registry.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec';
import type {
  App,
  Component,
  Plugin,
  PluginManifest
} from 'obsidian';

import debug from 'debug';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type {
  PluginApiContract,
  PluginApiRef,
  PublishPluginApiParams,
  WatchPluginApiParams
} from './plugin-api.ts';

import {
  nextTickAsync,
  waitForAllAsyncOperations
} from '../../async.ts';
import { getLibDebugger } from '../../debug.ts';
import {
  castTo,
  normalizeOptionalProperties
} from '../../object-utils.ts';
import { getObsidianDevUtilsState } from '../../obsidian-dev-utils-state.ts';
import { strictProxy } from '../../strict-proxy.ts';
import {
  PluginApiPayloadKind,
  PluginApiRevokedError,
  PluginApiUnavailabilityReason,
  PluginApiUnavailableError,
  PluginApiValidationError,
  publishPluginApi,
  watchPluginApi
} from './plugin-api.ts';

const PROVIDER_ID = 'provider-plugin';
const PLUGIN_API_DEBUG_NAMESPACE = 'obsidian-dev-utils:PluginApi';
const PLUGIN_API_DEBUGGER_NAME = 'PluginApi';
const PLUGIN_API_REGISTRY_STATE_KEY = 'pluginApiRegistry';
const SHORT_TIMEOUT_IN_MILLISECONDS = 50;

// `compare-versions` rejects a bare `*`, so "any version" is spelled as an open lower bound.
const ANY_VERSION_RANGE = '>=0.0.0';

const SYMBOL_KEY: unique symbol = Symbol('tag');

interface GreeterApi {
  greet(name: string): string;
  greeting: string;
}

interface PublishOptions {
  readonly api?: object;
  readonly apiVersion?: string;
  readonly contract?: PluginApiContract;
  readonly pluginId?: string;
}

interface RegistryShape {
  records: Record<string, unknown[]>;
  subscribers: (() => void)[];
}

interface SymbolKeyedApi {
  [SYMBOL_KEY](): string;
}

interface TestHarness {
  readonly app: App;
  /**
   * Publishes an API on behalf of a plugin and returns the function that unloads that plugin.
   */
  publish(options?: PublishOptions): () => void;
  /**
   * Starts a watch and returns the ref plus the function that unloads the consuming component.
   */
  watch<TApi extends object>(options?: WatchOptions): WatchResult<TApi>;
}

interface WatchOptions {
  readonly apiVersionRange?: string;
  readonly contract?: PluginApiContract;
  readonly pluginId?: string;
}

interface WatchResult<TApi extends object> {
  readonly ref: PluginApiRef<TApi>;
  unloadComponent(): void;
}

describe('plugin-api', () => {
  let savedDebugNamespaces: string;

  beforeEach(() => {
    savedDebugNamespaces = debug.load() ?? '';
    debug.enable('');
  });

  afterEach(() => {
    debug.enable(savedDebugNamespaces);
    vi.restoreAllMocks();
  });

  describe('publishPluginApi', () => {
    it('should make the API visible to a watcher', () => {
      const harness = createHarness();
      harness.publish();
      const { ref } = harness.watch<GreeterApi>();
      expect(ref.value?.greet('world')).toBe('Hello, world!');
    });

    it('should revoke the record when the publishing plugin unloads', () => {
      const harness = createHarness();
      const unloadPlugin = harness.publish();
      const { ref } = harness.watch<GreeterApi>();
      unloadPlugin();
      expect(ref.value).toBeNull();
    });

    it('should republish after a disable/enable cycle', () => {
      const harness = createHarness();
      const unloadPlugin = harness.publish();
      const { ref } = harness.watch<GreeterApi>();
      unloadPlugin();
      expect(ref.value).toBeNull();

      harness.publish();
      expect(ref.value?.greet('again')).toBe('Hello, again!');
    });

    it('should reject a second publish of the same API version', () => {
      const harness = createHarness();
      harness.publish({ apiVersion: '1.0.0' });
      expect(() => harness.publish({ apiVersion: '1.0.0' })).toThrow(
        'The plugin "provider-plugin" has already published the API version "1.0.0".'
      );
    });

    it('should allow several API versions side by side', () => {
      const harness = createHarness();
      harness.publish({ api: createGreeterApi('Hello'), apiVersion: '1.0.0' });
      harness.publish({ api: createGreeterApi('Hi'), apiVersion: '2.0.0' });

      expect(harness.watch<GreeterApi>({ apiVersionRange: '^1' }).ref.value?.greet('a')).toBe('Hello, a!');
      expect(harness.watch<GreeterApi>({ apiVersionRange: '^2' }).ref.value?.greet('a')).toBe('Hi, a!');
    });

    it('should tolerate the record already being gone when the plugin unloads', () => {
      const harness = createHarness();
      const unloadPlugin = harness.publish();
      getRegistry().records = {};
      expect(() => {
        unloadPlugin();
      }).not.toThrow();
    });
  });

  describe('watchPluginApi', () => {
    it('should read null before the provider publishes', () => {
      const harness = createHarness();
      expect(harness.watch<GreeterApi>().ref.value).toBeNull();
    });

    it('should pick the highest version satisfying the requested range', () => {
      const harness = createHarness();
      harness.publish({ api: createGreeterApi('One'), apiVersion: '1.0.0' });
      harness.publish({ api: createGreeterApi('Two'), apiVersion: '1.9.0' });
      harness.publish({ api: createGreeterApi('Three'), apiVersion: '2.0.0' });

      expect(harness.watch<GreeterApi>({ apiVersionRange: '^1' }).ref.value?.greet('x')).toBe('Two, x!');
    });

    it('should ignore a record whose version does not satisfy the range', () => {
      const harness = createHarness();
      harness.publish({ apiVersion: '1.0.0' });
      expect(harness.watch<GreeterApi>({ apiVersionRange: '^2' }).ref.value).toBeNull();
    });

    it('should ignore a record missing a method the published contract declares', () => {
      const harness = createHarness();
      harness.publish({ api: { greeting: 'Hello' }, contract: { greet: {} } });
      expect(harness.watch<GreeterApi>().ref.value).toBeNull();
    });

    it('should prefer the consumer contract over the published one', () => {
      const harness = createHarness();
      harness.publish({ contract: { greet: {} } });
      expect(harness.watch<GreeterApi>({ contract: { farewell: {} } }).ref.value).toBeNull();
    });

    it('should fire change when the value appears and again when it goes away', () => {
      const harness = createHarness();
      const { ref } = harness.watch<GreeterApi>();
      const onChange = vi.fn();
      ref.on('change', onChange);

      const unloadPlugin = harness.publish();
      expect(onChange).toHaveBeenCalledTimes(1);

      unloadPlugin();
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('should not fire change when an unrelated plugin publishes', () => {
      const harness = createHarness();
      const { ref } = harness.watch<GreeterApi>();
      const onChange = vi.fn();
      ref.on('change', onChange);

      harness.publish({ pluginId: 'unrelated-plugin' });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should stop updating once the consuming component unloads', () => {
      const harness = createHarness();
      const { ref, unloadComponent } = harness.watch<GreeterApi>();
      unloadComponent();
      harness.publish();
      expect(ref.value).toBeNull();
    });

    it('should tolerate the consuming component unloading twice', () => {
      const harness = createHarness();
      const { unloadComponent } = harness.watch<GreeterApi>();
      unloadComponent();
      expect(() => {
        unloadComponent();
      }).not.toThrow();
    });

    it('should notify over a snapshot, so a watcher torn down mid-sweep cannot break the others', () => {
      const harness = createHarness();
      const first = harness.watch<GreeterApi>();
      const second = harness.watch<GreeterApi>();
      first.ref.on('change', () => {
        second.unloadComponent();
      });

      expect(() => {
        harness.publish();
      }).not.toThrow();
      expect(first.ref.value).not.toBeNull();
    });

    it('should read a record written by a different library copy', () => {
      const harness = createHarness();
      // Written by hand — exactly the bytes a FOREIGN `obsidian-dev-utils` copy would leave behind, never
      // Through `publishPluginApi`. Nothing here is an instance of any class this copy owns, and the bag
      // Deliberately omits `subscribers`, as an older copy's would.
      getObsidianDevUtilsState<object>(PLUGIN_API_REGISTRY_STATE_KEY, {}).value = {
        records: {
          [PROVIDER_ID]: [{
            api: createGreeterApi('Foreign'),
            apiVersion: '1.0.0',
            contract: { greet: {} },
            isRevoked: false,
            pluginId: PROVIDER_ID
          }]
        }
      };

      expect(harness.watch<GreeterApi>().ref.value?.greet('copy')).toBe('Foreign, copy!');
    });
  });

  describe('the revocable handle', () => {
    it('should throw a named error when a property is read after the provider unloads', () => {
      const harness = createHarness();
      const unloadPlugin = harness.publish();
      const cachedApi = harness.watch<GreeterApi>().ref.value;
      expect(cachedApi).not.toBeNull();

      unloadPlugin();

      expect(() => cachedApi?.greeting).toThrow(PluginApiRevokedError);
      expect(() => cachedApi?.greeting).toThrow(
        'The API of the plugin "provider-plugin" has been revoked, because the plugin was unloaded.'
      );
    });

    it('should carry the revoked reason', () => {
      const error = new PluginApiRevokedError(PROVIDER_ID);
      expect(error).toBeInstanceOf(PluginApiUnavailableError);
      expect(error.reason).toBe(PluginApiUnavailabilityReason.Revoked);
      expect(error.pluginId).toBe(PROVIDER_ID);
    });

    it('should pass non-function members through untouched', () => {
      const harness = createHarness();
      harness.publish();
      expect(harness.watch<GreeterApi>().ref.value?.greeting).toBe('Hello');
    });

    it('should return a stable identity for the same method', () => {
      const harness = createHarness();
      harness.publish();
      const api = harness.watch<GreeterApi>().ref.value;
      expect(api?.greet).toBe(api?.greet);
    });

    it('should invoke methods with the raw API as `this`, so private fields keep working', () => {
      const harness = createHarness();

      class PrivateGreeter {
        readonly #greeting = 'Private';

        public greet(name: string): string {
          return `${this.#greeting}, ${name}!`;
        }
      }

      harness.publish({ api: new PrivateGreeter() });
      expect(harness.watch<PrivateGreeter>().ref.value?.greet('field')).toBe('Private, field!');
    });

    it('should wrap a symbol-keyed method without consulting the contract', () => {
      const harness = createHarness();
      const api: SymbolKeyedApi = { [SYMBOL_KEY]: (): string => 'symbol-result' };
      harness.publish({ api });

      const handle = harness.watch<SymbolKeyedApi>().ref.value;
      expect(handle?.[SYMBOL_KEY]()).toBe('symbol-result');
    });
  });

  describe('whenAvailable', () => {
    it('should resolve immediately when the API is already published', async () => {
      const harness = createHarness();
      harness.publish();
      const api = await harness.watch<GreeterApi>().ref.whenAvailable();
      expect(api.greet('now')).toBe('Hello, now!');
    });

    it('should resolve once the provider publishes', async () => {
      const harness = createHarness();
      const promise = harness.watch<GreeterApi>().ref.whenAvailable();
      harness.publish();
      const api = await promise;
      expect(api.greet('later')).toBe('Hello, later!');
    });

    it('should report a plugin that is not installed', async () => {
      const harness = createHarness({ isInstalled: false });
      await expectUnavailable(harness.watch<GreeterApi>().ref, PluginApiUnavailabilityReason.NotInstalled);
    });

    it('should report a plugin that is installed but not enabled', async () => {
      const harness = createHarness({ isEnabled: false });
      await expectUnavailable(harness.watch<GreeterApi>().ref, PluginApiUnavailabilityReason.NotEnabled);
    });

    it('should report a plugin that published nothing', async () => {
      const harness = createHarness();
      await expectUnavailable(harness.watch<GreeterApi>().ref, PluginApiUnavailabilityReason.NotPublished);
    });

    it('should report a version mismatch', async () => {
      const harness = createHarness();
      harness.publish({ apiVersion: '1.0.0' });
      await expectUnavailable(
        harness.watch<GreeterApi>({ apiVersionRange: '^2' }).ref,
        PluginApiUnavailabilityReason.VersionMismatch
      );
    });

    it('should report a shape mismatch', async () => {
      const harness = createHarness();
      harness.publish({ api: { greeting: 'Hello' }, contract: { greet: {} } });
      await expectUnavailable(harness.watch<GreeterApi>().ref, PluginApiUnavailabilityReason.ShapeMismatch);
    });

    it('should derive a message from the plugin id and the reason', () => {
      const error = new PluginApiUnavailableError({
        pluginId: PROVIDER_ID,
        reason: PluginApiUnavailabilityReason.NotPublished
      });
      expect(error.message).toBe('The API of the plugin "provider-plugin" is unavailable: notPublished.');
    });

    it('should honour an explicit message', () => {
      const error = new PluginApiUnavailableError({
        message: 'Custom.',
        pluginId: PROVIDER_ID,
        reason: PluginApiUnavailabilityReason.NotPublished
      });
      expect(error.message).toBe('Custom.');
    });
  });

  describe('payload validation', () => {
    beforeEach(() => {
      debug.enable(PLUGIN_API_DEBUG_NAMESPACE);
    });

    it('should not validate while the debugger is disabled', () => {
      debug.enable('');
      const harness = createHarness();
      harness.publish({ contract: { greet: { input: createAlwaysFailingSchema() } } });
      expect(harness.watch<GreeterApi>().ref.value?.greet('unchecked')).toBe('Hello, unchecked!');
    });

    it('should not wrap a method the contract does not declare', () => {
      const harness = createHarness();
      harness.publish({ contract: {} });
      expect(harness.watch<GreeterApi>().ref.value?.greet('undeclared')).toBe('Hello, undeclared!');
    });

    it('should pass a payload the schema accepts', () => {
      const harness = createHarness();
      harness.publish({
        contract: {
          greet: {
            input: createSchema((value) => Array.isArray(value)),
            output: createSchema((value) => typeof value === 'string')
          }
        }
      });
      expect(harness.watch<GreeterApi>().ref.value?.greet('ok')).toBe('Hello, ok!');
    });

    it('should throw when the input fails', () => {
      const harness = createHarness();
      harness.publish({ contract: { greet: { input: createAlwaysFailingSchema() } } });
      const api = harness.watch<GreeterApi>().ref.value;

      expect(() => api?.greet('bad')).toThrow(PluginApiValidationError);
      expect(() => api?.greet('bad')).toThrow(
        'The input of "provider-plugin" API method "greet" failed validation: always fails'
      );
    });

    it('should throw when a synchronous output fails', () => {
      const harness = createHarness();
      harness.publish({ contract: { greet: { output: createAlwaysFailingSchema() } } });
      const api = harness.watch<GreeterApi>().ref.value;

      expect(() => api?.greet('bad')).toThrow(
        'The output of "provider-plugin" API method "greet" failed validation: always fails'
      );
    });

    it('should carry the failing method, plugin, and issues', () => {
      const error = new PluginApiValidationError({
        issues: [{ message: 'nope' }],
        methodName: 'greet',
        payloadKind: PluginApiPayloadKind.Output,
        pluginId: PROVIDER_ID
      });
      expect(error.methodName).toBe('greet');
      expect(error.pluginId).toBe(PROVIDER_ID);
      expect(error.issues).toEqual([{ message: 'nope' }]);
    });

    it('should validate what a thenable return value resolves to', async () => {
      const harness = createHarness();
      const api = {
        load: async (): Promise<string> => {
          await nextTickAsync();
          return 'value';
        }
      };
      harness.publish({ api, contract: { load: { output: createAlwaysFailingSchema() } } });

      const handle = harness.watch<typeof api>().ref.value;
      await expect(handle?.load()).rejects.toThrow(PluginApiValidationError);
    });

    it('should let a thenable return value through when it resolves to something valid', async () => {
      const harness = createHarness();
      const api = {
        load: async (): Promise<string> => {
          await nextTickAsync();
          return 'value';
        }
      };
      harness.publish({ api, contract: { load: { output: createSchema((value) => value === 'value') } } });

      const handle = harness.watch<typeof api>().ref.value;
      await expect(handle?.load()).resolves.toBe('value');
    });

    it('should treat a null return value as a plain value, not a thenable', () => {
      const harness = createHarness();
      const api = { read: (): null => null };
      harness.publish({ api, contract: { read: { output: createSchema((value) => value === null) } } });
      expect(harness.watch<typeof api>().ref.value?.read()).toBeNull();
    });

    it('should treat an object with a non-callable `then` as a plain value', () => {
      const harness = createHarness();
      // eslint-disable-next-line unicorn/no-thenable -- A non-callable `then` is exactly the shape under test.
      const api = { read: (): object => ({ then: 'not a function' }) };
      harness.publish({ api, contract: { read: { output: createSchema((value) => typeof value === 'object') } } });
      // eslint-disable-next-line unicorn/no-thenable -- A non-callable `then` is exactly the shape under test.
      expect(harness.watch<typeof api>().ref.value?.read()).toEqual({ then: 'not a function' });
    });

    it('should report an asynchronous schema failure through the debugger instead of throwing', async () => {
      const loggedCalls = captureDebuggerCalls();

      const harness = createHarness();
      harness.publish({ contract: { greet: { input: createAlwaysFailingSchema({ isAsync: true }) } } });

      expect(harness.watch<GreeterApi>().ref.value?.greet('async')).toBe('Hello, async!');
      await waitForAllAsyncOperations();

      // `debug` decorates the call before it reaches `log`, and how it decorates depends on whether colors
      // Are on: it always prepends the namespace, and in color mode also appends a `+0ms` argument. So the
      // Format string is matched by substring and the values by containment, rather than the call by shape —
      // Otherwise this passes standalone and fails under the full suite, where the two differ.
      expect(loggedCalls).toHaveLength(1);
      const [format, ...$arguments] = loggedCalls[0] ?? [];
      expect(String(format)).toContain('Asynchronous validation of the %s of "%s" API method "%s" failed: %s');
      expect($arguments).toEqual(expect.arrayContaining([
        PluginApiPayloadKind.Input,
        PROVIDER_ID,
        'greet',
        'always fails'
      ]));
    });

    it('should stay silent when an asynchronous schema passes', async () => {
      const loggedCalls = captureDebuggerCalls();

      const harness = createHarness();
      harness.publish({ contract: { greet: { input: createSchema(() => true, { isAsync: true }) } } });

      expect(harness.watch<GreeterApi>().ref.value?.greet('async')).toBe('Hello, async!');
      await waitForAllAsyncOperations();

      expect(loggedCalls).toHaveLength(0);
    });

    it('should render an issue path alongside its message', () => {
      const harness = createHarness();
      harness.publish({
        contract: {
          greet: {
            input: createFailingSchemaWithIssues([
              { message: 'too short', path: ['0'] },
              { message: 'nested', path: [{ key: 'options' }, 'name'] },
              { message: 'no path' },
              { message: 'empty path', path: [] }
            ])
          }
        }
      });
      const api = harness.watch<GreeterApi>().ref.value;

      expect(() => api?.greet('bad')).toThrow(
        '0: too short; options.name: nested; no path; empty path'
      );
    });
  });
});

/**
 * Options for {@link createHarness}.
 */
interface CreateHarnessOptions {
  readonly isEnabled?: boolean;
  readonly isInstalled?: boolean;
}

/**
 * Options for the schema builders.
 */
interface CreateSchemaOptions {
  readonly isAsync?: boolean;
}

/**
 * Redirects the library debugger's output into an array, so a test can assert on it without printing and
 * without touching the loosely typed `mock.calls`.
 *
 * @returns The array the calls accumulate into.
 */
function captureDebuggerCalls(): unknown[][] {
  const loggedCalls: unknown[][] = [];
  vi.spyOn(getLibDebugger(PLUGIN_API_DEBUGGER_NAME), 'log').mockImplementation((...$arguments: unknown[]): void => {
    loggedCalls.push($arguments);
  });
  return loggedCalls;
}

/**
 * Builds a Standard Schema that always reports a single generic issue.
 *
 * @param options - Whether the schema answers asynchronously.
 * @returns The schema.
 */
function createAlwaysFailingSchema(options: CreateSchemaOptions = {}): StandardSchemaV1 {
  return createSchema(() => false, options);
}

/**
 * Builds a Standard Schema that always reports the given issues.
 *
 * @param issues - The issues to report.
 * @returns The schema.
 */
function createFailingSchemaWithIssues(issues: readonly StandardSchemaV1.Issue[]): StandardSchemaV1 {
  return {
    '~standard': {
      validate: (): StandardSchemaV1.Result<unknown> => ({ issues }),
      vendor: 'test',
      version: 1
    }
  };
}

/**
 * Builds the API object most tests publish.
 *
 * @param greeting - The greeting the API returns.
 * @returns The API.
 */
function createGreeterApi(greeting: string): GreeterApi {
  return {
    greet: (name: string): string => `${greeting}, ${name}!`,
    greeting
  };
}

/**
 * Builds the app doubles and the publish/watch helpers every test in this file shares.
 *
 * @param options - Whether the provider plugin is installed and enabled.
 * @returns The harness.
 */
function createHarness(options: CreateHarnessOptions = {}): TestHarness {
  const isInstalled = options.isInstalled ?? true;
  const isEnabled = options.isEnabled ?? isInstalled;

  // A null-prototype record so a missing key reads as `undefined` rather than resolving up the chain.
  const manifests: App['plugins']['manifests'] = {};
  Object.setPrototypeOf(manifests, null);
  if (isInstalled) {
    manifests[PROVIDER_ID] = strictProxy<PluginManifest>({ id: PROVIDER_ID });
  }

  const app = strictProxy<App>({
    plugins: strictProxy<App['plugins']>({
      enabledPlugins: new Set<string>(isEnabled ? [PROVIDER_ID] : []),
      manifests
    })
  });

  return {
    app,
    publish(publishOptions: PublishOptions = {}): () => void {
      const unloadCallbacks: (() => void)[] = [];
      publishPluginApi(normalizeOptionalProperties<PublishPluginApiParams<object>>({
        api: publishOptions.api ?? createGreeterApi('Hello'),
        apiVersion: publishOptions.apiVersion ?? '1.0.0',
        contract: publishOptions.contract,
        plugin: strictProxy<Plugin>({
          manifest: strictProxy<PluginManifest>({ id: publishOptions.pluginId ?? PROVIDER_ID }),
          register: (callback: () => void): void => {
            unloadCallbacks.push(callback);
          }
        })
      }));

      return (): void => {
        for (const callback of unloadCallbacks) {
          callback();
        }
      };
    },
    watch<TApi extends object>(watchOptions: WatchOptions = {}): WatchResult<TApi> {
      const unloadCallbacks: (() => void)[] = [];
      const ref = watchPluginApi<TApi>(normalizeOptionalProperties<WatchPluginApiParams>({
        apiVersionRange: watchOptions.apiVersionRange ?? ANY_VERSION_RANGE,
        app,
        component: strictProxy<Component>({
          register: (callback: () => void): void => {
            unloadCallbacks.push(callback);
          }
        }),
        contract: watchOptions.contract,
        pluginId: watchOptions.pluginId ?? PROVIDER_ID
      }));

      return {
        ref,
        unloadComponent: (): void => {
          for (const callback of unloadCallbacks) {
            callback();
          }
        }
      };
    }
  };
}

/**
 * Builds a Standard Schema from a predicate.
 *
 * @param checkIsValid - Decides whether the value is valid.
 * @param options - Whether the schema answers asynchronously.
 * @returns The schema.
 */
function createSchema(checkIsValid: (value: unknown) => boolean, options: CreateSchemaOptions = {}): StandardSchemaV1 {
  return {
    '~standard': {
      validate: (value: unknown): Promise<StandardSchemaV1.Result<unknown>> | StandardSchemaV1.Result<unknown> => {
        const result: StandardSchemaV1.Result<unknown> = checkIsValid(value)
          ? { value }
          : { issues: [{ message: 'always fails' }] };
        return options.isAsync ? Promise.resolve(result) : result;
      },
      vendor: 'test',
      version: 1
    }
  };
}

/**
 * Asserts that a ref times out and classifies the failure with the expected reason.
 *
 * @typeParam TApi - The API type the ref is typed against.
 * @param ref - The ref to await.
 * @param reason - The expected reason.
 * @returns A {@link Promise} that resolves once the assertion has run.
 */
async function expectUnavailable<TApi extends object>(
  ref: PluginApiRef<TApi>,
  reason: PluginApiUnavailabilityReason
): Promise<void> {
  await expect(ref.whenAvailable({ timeoutInMilliseconds: SHORT_TIMEOUT_IN_MILLISECONDS }))
    .rejects
    .toMatchObject({ pluginId: PROVIDER_ID, reason });
}

/**
 * Reads the shared registry, so a test can simulate what a different library copy left in it.
 *
 * @returns The registry.
 */
function getRegistry(): RegistryShape {
  return castTo<RegistryShape>(getObsidianDevUtilsState<object>(PLUGIN_API_REGISTRY_STATE_KEY, {}).value);
}
