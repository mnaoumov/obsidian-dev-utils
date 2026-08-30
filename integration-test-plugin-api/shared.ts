/**
 * @file
 *
 * The contract the two plugin-API integration-test plugins agree on.
 *
 * This module is compiled into BOTH bundles, so each plugin ends up with its own copy of these
 * declarations — exactly as two independently released plugins would. What crosses the registry at runtime
 * is the provider's contract object, schemas included, which is precisely what has to survive the trip.
 *
 * The schemas are HAND-WRITTEN rather than built with zod, for two reasons: `obsidian-dev-utils` has no
 * schema library as a dependency and must not acquire one through a test, and a hand-rolled validator is
 * itself the proof that the Standard Schema interface — not any particular library — is what the registry
 * talks to.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec';

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

/**
 * The contract both sides declare: the method name that drives the shape check, plus the payload schemas
 * that drive validation once the library debugger is on.
 */
export const GREETER_CONTRACT: PluginApiContract = {
  greet: {
    // `input` validates the ARGUMENT LIST, so the value handed to it is `['world']`, not `'world'`.
    input: createSchema(
      (value: unknown): boolean => Array.isArray(value) && value.length === 1 && typeof value[0] === 'string',
      'greet expects exactly one string argument'
    ),
    output: createSchema((value: unknown): boolean => typeof value === 'string', 'greet must return a string')
  }
};

/**
 * Builds a minimal Standard Schema from a predicate.
 *
 * @param checkIsValid - Decides whether the value is acceptable.
 * @param message - The issue message reported when it is not.
 * @returns The schema.
 */
function createSchema(checkIsValid: (value: unknown) => boolean, message: string): StandardSchemaV1 {
  return {
    '~standard': {
      validate: (value: unknown): StandardSchemaV1.Result<unknown> => checkIsValid(value) ? { value } : { issues: [{ message }] },
      vendor: 'obsidian-dev-utils-integration-test',
      version: 1
    }
  };
}
