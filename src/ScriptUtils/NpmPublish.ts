/**
 * @packageDocumentation
 *
 * Contains utility functions for NPM publish.
 */

import {
  existsSync,
  loadEnvFile,
  process
} from './NodeModules.ts';
import {
  execFromRoot,
  resolvePathFromRoot
} from './Root.ts';

interface NpmEnv {
  NPM_TOKEN: string;
}

/**
 * Publish to NPM.
 *
 * @param isBeta - Whether to publish to the beta NPM registry.
 */
export async function publish(isBeta?: boolean): Promise<void> {
  const envPath = resolvePathFromRoot('.env');
  if (envPath && existsSync(envPath)) {
    loadEnvFile(envPath);
  }
  const npmEnv = process.env as Partial<NpmEnv>;
  await execFromRoot(['npm', 'config', 'set', `//registry.npmjs.org/:_authToken=${npmEnv.NPM_TOKEN ?? ''}`]);

  const tag = isBeta ? 'beta' : 'latest';
  await execFromRoot(['npm', 'publish', '--tag', tag]);
}
