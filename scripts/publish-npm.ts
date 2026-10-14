/**
 * @file
 *
 * The NPM publish entry point `.github/workflows/publish-npm.yml` runs. It refuses for now, for the reason
 * `scripts/version.ts` gives: the workspace packages are published together, and that is not wired up yet.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';

await wrapCliTask(() => {
  throw new Error('Publishing the workspace packages is not wired up yet: they are published together, which is a change of its own.');
});
