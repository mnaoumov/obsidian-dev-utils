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

import { watchPluginApi } from '../../src/obsidian/plugin/plugin-api.ts';
import {
  GREETER_CONTRACT,
  PROVIDER_PLUGIN_ID
} from '../shared.ts';

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
      greetV1: (): null | string => refV1.value?.greet('world') ?? null,
      greetV2: (): null | string => refV2.value?.greet('world') ?? null,
      readCachedApi: (): CachedApiProbeResult => {
        try {
          return {
            error: null,
            greeting: this.cachedApi?.greet('cached') ?? null
          };
        } catch (error) {
          const thrown = error as Error;
          return {
            error: `${thrown.name}: ${thrown.message}`,
            greeting: null
          };
        }
      }
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
