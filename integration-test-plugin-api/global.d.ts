/**
 * @file
 *
 * Global type augmentation for the plugin-API integration-test plugins.
 *
 * The consumer plugin publishes a probe on `window` so an `evalInObsidian` closure — which cannot import
 * anything — can drive the watch and read back plain, serializable results.
 */

declare global {
  /**
   * What one probe call reports back about a cached (possibly revoked) handle.
   */
  interface CachedApiProbeResult {
    /**
     * `<ErrorName>: <message>` when the read threw, otherwise `null`.
     *
     * The name is compared as a STRING on purpose: the consumer's `PluginApiRevokedError` class comes from a
     * different bundle than the provider's, so no `instanceof` across the two could ever hold.
     */
    readonly error: null | string;

    /**
     * The greeting the cached handle produced, or `null` when the read threw.
     */
    readonly greeting: null | string;
  }

  /**
   * The surface the consumer plugin exposes for the integration test to drive.
   */
  interface PluginApiIntegrationTestProbe {
    /**
     * Stashes the CURRENT `^2` handle in a field, the way a consumer that caches the API would.
     */
    cacheCurrentApi(): void;

    /**
     * Reads the `^1` watch.
     *
     * @returns The greeting, or `null` when no `^1` API is available.
     */
    greetV1(): null | string;

    /**
     * Reads the `^2` watch.
     *
     * @returns The greeting, or `null` when no `^2` API is available.
     */
    greetV2(): null | string;

    /**
     * Calls through the handle stashed by {@link PluginApiIntegrationTestProbe.cacheCurrentApi}.
     *
     * @returns What the call produced, or the error it threw.
     */
    readCachedApi(): CachedApiProbeResult;
  }

  interface Window {
    __pluginApiIntegrationTestProbe?: PluginApiIntegrationTestProbe;
  }
}

export {};
