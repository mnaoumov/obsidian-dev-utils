/// <reference types="obsidian-integration-testing/vitest/typings" />

/**
 * @file
 *
 * The cross-COPY test for the plugin API registry.
 *
 * This file runs in the dedicated `obsidian-integration-tests:plugin-api` project (see
 * `scripts/vitest-config.ts`), whose global setup seeds two SEPARATELY BUNDLED plugins into one vault. Each
 * therefore holds its own copy of `obsidian-dev-utils` — two module instances, two sets of classes, sharing
 * only the realm-global registry bag.
 *
 * That is the one condition no unit test can reproduce, and the one the design turns on: a registry record is
 * a wire format between library versions, so every read of it must be structural. If anything in
 * `plugin-api.ts` ever reaches for `instanceof`, this file is where it fails.
 */

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  PLUGIN_API_CONSUMER_PLUGIN_ID,
  PLUGIN_API_PROVIDER_PLUGIN_ID
} from '../../../scripts/integration-test-plugin-api-global-setup.ts';

const WAIT_TIMEOUT_IN_MILLISECONDS = 10_000;

/**
 * What the disable/enable probe reports back, gathered in one closure so the whole cycle runs inside a single
 * evaluation and the assertions live on the Node side.
 */
interface LifecycleProbe {
  readonly cachedAfterRevoke: string;
  readonly cachedBeforeRevoke: null | string;
  readonly cachedStillRevokedAfterReEnable: string;
  readonly greetingAfterReEnable: null | string;
  readonly greetingWhileDisabled: null | string;
}

/**
 * What the validation probe reports back.
 */
interface ValidationProbe {
  readonly invalidCallError: null | string;
  readonly validCallGreeting: null | string;
}

/**
 * What the negotiation probe reports back.
 */
interface VersionProbe {
  readonly greetingV1: null | string;
  readonly greetingV2: null | string;
  readonly isConsumerEnabled: boolean;
  readonly isProviderEnabled: boolean;
}

describe('cross-copy plugin API registry', () => {
  beforeEach(async () => {
    await evalInObsidian({
      async callback({ app, lib: { waitUntil }, providerPluginId, waitTimeoutInMilliseconds }): Promise<void> {
        if (!app.plugins.enabledPlugins.has(providerPluginId)) {
          await app.plugins.enablePlugin(providerPluginId);
        }

        // The consuming plugin only re-reads the registry when it is notified, so wait on the value the test
        // Actually depends on rather than on the enable call returning.
        await waitUntil({
          message: 'the provider API to be visible to the consumer',
          predicate: (): boolean => window.__pluginApiIntegrationTestProbe?.greetV2() !== null,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });
      },
      input: {
        providerPluginId: PLUGIN_API_PROVIDER_PLUGIN_ID,
        waitTimeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
      }
    });
  });

  it('should let a consumer reach an API published by a different library copy', async () => {
    const probe = await evalInObsidian({
      callback({ app, consumerPluginId, providerPluginId }): VersionProbe {
        const testProbe = window.__pluginApiIntegrationTestProbe;
        if (!testProbe) {
          throw new Error('The plugin-API consumer plugin did not install its probe.');
        }

        return {
          greetingV1: testProbe.greetV1(),
          greetingV2: testProbe.greetV2(),
          isConsumerEnabled: app.plugins.enabledPlugins.has(consumerPluginId),
          isProviderEnabled: app.plugins.enabledPlugins.has(providerPluginId)
        };
      },
      input: {
        consumerPluginId: PLUGIN_API_CONSUMER_PLUGIN_ID,
        providerPluginId: PLUGIN_API_PROVIDER_PLUGIN_ID
      }
    });

    expect(probe.isConsumerEnabled).toBe(true);
    expect(probe.isProviderEnabled).toBe(true);

    // Each watch negotiates its own range against the two versions published side by side.
    expect(probe.greetingV1).toBe('v1.0.0: world');
    expect(probe.greetingV2).toBe('v2.0.0: world');
  });

  it('should validate a payload against a schema authored by the other library copy', async () => {
    const probe = await evalInObsidian({
      callback(): ValidationProbe {
        const testProbe = window.__pluginApiIntegrationTestProbe;
        if (!testProbe) {
          throw new Error('The plugin-API consumer plugin did not install its probe.');
        }

        return {
          // The schema doing the rejecting was authored and published by the PROVIDER's copy of the library
          // And traveled across in the registry record; the wrapper invoking it was built by the CONSUMER's
          // Copy, and the debug gate it consulted is the consumer's too.
          invalidCallError: String(testProbe.callWithInvalidInputWhileValidating().error),
          // Validation is off again afterwards, and a well-typed call is unaffected either way.
          validCallGreeting: testProbe.greetV2()
        };
      }
    });

    expect(probe.invalidCallError).toContain('PluginApiValidationError');
    expect(probe.invalidCallError).toContain('greet');
    expect(probe.invalidCallError).toContain('greet expects exactly one string argument');
    expect(probe.validCallGreeting).toBe('v2.0.0: world');
  });

  it('should revoke a cached handle when the provider unloads and recover on re-enable', async () => {
    const probe = await evalInObsidian({
      async callback({ app, lib: { waitUntil }, providerPluginId, waitTimeoutInMilliseconds }): Promise<LifecycleProbe> {
        const testProbe = window.__pluginApiIntegrationTestProbe;
        if (!testProbe) {
          throw new Error('The plugin-API consumer plugin did not install its probe.');
        }

        // Cache the handle in a field, the way a consumer that ignores the ref would.
        testProbe.cacheCurrentApi();
        const cachedBeforeRevoke = testProbe.readCachedApi().greeting;

        await app.plugins.disablePlugin(providerPluginId);
        await waitUntil({
          message: 'the provider API to disappear from the consumer',
          predicate: (): boolean => testProbe.greetV2() === null,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });

        const greetingWhileDisabled = testProbe.greetV2();
        // The class that threw lives in the PROVIDER-less consumer bundle, so this is compared by name, not
        // By identity — no `instanceof` could ever span the two copies.
        const cachedAfterRevoke = String(testProbe.readCachedApi().error);

        await app.plugins.enablePlugin(providerPluginId);
        await waitUntil({
          message: 'the provider API to come back after re-enable',
          predicate: (): boolean => testProbe.greetV2() !== null,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });

        return {
          cachedAfterRevoke,
          cachedBeforeRevoke,
          // A re-enable publishes a NEW record, so the OLD handle stays dead forever. This is precisely why
          // The watch, and not a one-shot `require`, is the whole consumer surface.
          cachedStillRevokedAfterReEnable: String(testProbe.readCachedApi().error),
          greetingAfterReEnable: testProbe.greetV2(),
          greetingWhileDisabled
        };
      },
      input: {
        providerPluginId: PLUGIN_API_PROVIDER_PLUGIN_ID,
        waitTimeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
      }
    });

    expect(probe.cachedBeforeRevoke).toBe('v2.0.0: cached');
    expect(probe.greetingWhileDisabled).toBeNull();
    expect(probe.cachedAfterRevoke).toContain('PluginApiRevokedError');
    expect(probe.cachedAfterRevoke).toContain(PLUGIN_API_PROVIDER_PLUGIN_ID);
    expect(probe.cachedStillRevokedAfterReEnable).toContain('PluginApiRevokedError');
    expect(probe.greetingAfterReEnable).toBe('v2.0.0: world');
  });
});
