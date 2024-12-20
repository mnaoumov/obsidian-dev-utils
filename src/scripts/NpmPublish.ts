/**
 * @packageDocumentation NpmPublish
 * Contains utility functions for NPM publish.
 */

import { config } from 'dotenv';

import { execFromRoot } from './Root.ts';

interface NpmConfig {
  NPM_TOKEN: string;
}

/**
 * Publish to NPM.
 * @param isBeta - Whether to publish to the beta NPM registry.
 */
export async function publish(isBeta?: boolean): Promise<void> {
  const dotenvConfigOutput = config();
  const npmConfig = (dotenvConfigOutput.parsed ?? {}) as Partial<NpmConfig>;
  await execFromRoot(['npm', 'config', 'set', '//registry.npmjs.org/:_authToken', npmConfig.NPM_TOKEN ?? '']);

  const tag = isBeta ? 'beta' : 'latest';
  await execFromRoot(['npm', 'publish', '--tag', tag]);
}
