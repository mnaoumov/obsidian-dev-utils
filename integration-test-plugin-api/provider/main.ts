/**
 * @file
 *
 * The PROVIDER half of the cross-copy plugin-API integration test.
 *
 * It is bundled separately from its consumer, so at runtime the two plugins hold DIFFERENT copies of
 * `obsidian-dev-utils` — different module instances, different classes, sharing only the realm-global
 * registry bag. That is the condition the registry's wire format has to survive, and it is what this pair
 * exists to prove.
 *
 * Two contract versions are published side by side, so the consumer's version negotiation has something to
 * choose between.
 */

/// <reference path="../global.d.ts" />

import { Plugin } from 'obsidian';

import type { GreeterApi } from '../shared.ts';

import { publishPluginApi } from '../../src/obsidian/plugin/plugin-api.ts';
import { GREETER_CONTRACT } from '../shared.ts';

/**
 * Publishes two versions of a trivial API, and revokes both when Obsidian unloads it.
 */
export default class PluginApiProviderPlugin extends Plugin {
  /**
   * Publishes the API. Both records are revoked automatically when this plugin unloads, because
   * `publishPluginApi` registers the revocation on it.
   */
  public override onload(): void {
    this.publishVersion('1.0.0');
    this.publishVersion('2.0.0');
  }

  /**
   * Publishes one contract version whose greeting names the version that produced it.
   *
   * @param apiVersion - The contract version to publish.
   */
  private publishVersion(apiVersion: string): void {
    const api: GreeterApi = {
      greet: (name: string): string => `v${apiVersion}: ${name}`
    };

    publishPluginApi({
      api,
      apiVersion,
      contract: GREETER_CONTRACT,
      plugin: this
    });
  }
}
