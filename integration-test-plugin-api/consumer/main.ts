/**
 * @file
 *
 * The CONSUMER half of the cross-copy plugin-API integration test.
 *
 * It starts its watches in `onload`, before the provider is guaranteed to have loaded — which is the load-order
 * problem the whole registry exists to solve — and exposes a probe on `window` so an `evalInObsidian` closure
 * (which cannot import anything) can drive it and read back plain, serializable results.
 */

/// <reference path="../global.d.ts" />

import { Plugin } from 'obsidian';

import type { PluginApiRef } from '../../src/obsidian/plugin/plugin-api.ts';
import type { GreeterApi } from '../shared.ts';

import { getDebugController } from '../../src/debug.ts';
import { castTo } from '../../src/object-utils.ts';
import { watchPluginApi } from '../../src/obsidian/plugin/plugin-api.ts';
import {
  GREETER_CONTRACT,
  PROVIDER_PLUGIN_ID
} from '../shared.ts';

const PLUGIN_API_DEBUG_NAMESPACE = 'obsidian-dev-utils:PluginApi';

// A number where the contract says string. The provider's published input schema is what rejects it.
const WRONGLY_TYPED_ARGUMENT = 42;

/**
 * Watches the provider's API at two version ranges and publishes a probe for the test to drive.
 */
export default class PluginApiConsumerPlugin extends Plugin {
  /**
   * A handle deliberately cached in a field, the way a consumer that ignores the ref would — so the test can
   * show what happens when the provider unloads underneath it.
   */
  private cachedApi: GreeterApi | null = null;

  /**
   * Starts both watches and installs the probe.
   */
  public override onload(): void {
    const refV1 = this.watch('^1');
    const refV2 = this.watch('^2');

    window.__pluginApiIntegrationTestProbe = {
      cacheCurrentApi: (): void => {
        this.cachedApi = refV2.value;
      },
      callWithInvalidInputWhileValidating: (): CachedApiProbeResult => {
        const debugController = getDebugController();
        const savedNamespaces = debugController.get();
        debugController.enable(PLUGIN_API_DEBUG_NAMESPACE);
        try {
          // The cast is the point: a real consumer reaches this state by drifting out of step with the
          // Provider, and the provider's own schema is what catches it — inside the CONSUMER's copy of the
          // Library, which is the crossing under test.
          return callSafely(() => refV2.value?.greet(castTo<string>(WRONGLY_TYPED_ARGUMENT)) ?? null);
        } finally {
          debugController.set(savedNamespaces);
        }
      },
      greetV1: (): null | string => refV1.value?.greet('world') ?? null,
      greetV2: (): null | string => refV2.value?.greet('world') ?? null,
      readCachedApi: (): CachedApiProbeResult => callSafely(() => this.cachedApi?.greet('cached') ?? null)
    };

    this.register(() => {
      delete window.__pluginApiIntegrationTestProbe;
    });
  }

  /**
   * Starts one watch, scoped to this plugin's lifetime.
   *
   * @param apiVersionRange - The contract versions this watch accepts.
   * @returns The live reference.
   */
  private watch(apiVersionRange: string): PluginApiRef<GreeterApi> {
    return watchPluginApi<GreeterApi>({
      apiVersionRange,
      app: this.app,
      component: this,
      contract: GREETER_CONTRACT,
      pluginId: PROVIDER_PLUGIN_ID
    });
  }
}

/**
 * Runs a call and reports either what it produced or the error it threw, as a serializable result.
 *
 * The error is reported by NAME rather than by identity: the class that threw lives in whichever bundle
 * created the handle, so no `instanceof` could span the two plugins.
 *
 * @param call - The call to make.
 * @returns The probe result.
 */
function callSafely(call: () => null | string): CachedApiProbeResult {
  try {
    return {
      error: null,
      greeting: call()
    };
  } catch (error) {
    const thrown = error as Error;
    return {
      error: `${thrown.name}: ${thrown.message}`,
      greeting: null
    };
  }
}
