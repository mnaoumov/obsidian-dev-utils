/**
 * @file
 *
 * The contract the two plugin-API integration-test plugins agree on.
 *
 * This module is compiled into BOTH bundles, so each plugin ends up with its own copy of these
 * declarations — exactly as two independently released plugins would. Nothing here crosses the registry at
 * runtime except plain strings and the API object itself.
 */

import type { PluginApiContract } from '../src/obsidian/plugin/plugin-api.ts';

/**
 * The `manifest.id` of the consuming plugin.
 */
export const CONSUMER_PLUGIN_ID = 'obsidian-dev-utils-plugin-api-consumer';

/**
 * The `manifest.id` of the providing plugin — the key the registry record is filed under.
 */
export const PROVIDER_PLUGIN_ID = 'obsidian-dev-utils-plugin-api-provider';

/**
 * The contract both sides declare. Only the method NAME matters for the shape check.
 */
export const GREETER_CONTRACT: PluginApiContract = { greet: {} };

/**
 * The API the provider publishes and the consumer compiled against.
 */
export interface GreeterApi {
  /**
   * Greets someone.
   *
   * @param name - Who to greet.
   * @returns The greeting, prefixed by the API version that produced it.
   */
  greet(name: string): string;
}
