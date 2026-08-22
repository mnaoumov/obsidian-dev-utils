/**
 * @file
 *
 * Contains utility functions for NPM publish.
 */

import { execFromRoot } from './root.ts';

/**
 * Publish to NPM.
 *
 * Authentication is intentionally not handled here. The publish is expected to run from a CI job
 * configured as a {@link https://docs.npmjs.com/trusted-publishers | trusted publisher} on npmjs.com,
 * where the npm CLI exchanges the job's short-lived OIDC token for a publish grant on its own. No NPM
 * token is read, written, or stored, and the published package gets provenance for free.
 *
 * Requires npm `11.5.1` or later.
 *
 * @param isBeta - Whether to publish to the beta NPM registry.
 */
export async function publish(isBeta?: boolean): Promise<void> {
  const tag = isBeta ? 'beta' : 'latest';
  await execFromRoot(['npm', 'publish', '--tag', tag]);
}
