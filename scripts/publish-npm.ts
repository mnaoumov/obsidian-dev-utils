/**
 * @file
 *
 * The NPM publish entry point `.github/workflows/publish-npm.yml` runs: publishes every workspace package at the
 * shared version, under the `beta` dist-tag for a pre-release and `latest` otherwise.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { readPackageJson } from '@mnaoumov/typescript-dev-toolkit/npm';
import { isPreRelease } from '@mnaoumov/typescript-dev-toolkit/version';

import { publishWorkspacePackages } from './helpers/workspace-release.ts';

await wrapCliTask(async () => {
  const { version } = await readPackageJson();
  if (!version) {
    throw new Error('The root package.json declares no version.');
  }
  await publishWorkspacePackages({ isBeta: isPreRelease(version) });
});
