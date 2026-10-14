/**
 * @file
 *
 * The release entry point of this repository: `npm run version '--' <type> [flags]`.
 *
 * The workspace packages are released TOGETHER, one version for all five. The generic release bumps the root
 * manifest, settles the root `CHANGELOG.md`, commits, tags, pushes and creates the GitHub release;
 * `setWorkspacePackageVersions` adds every package's manifest, the sibling dependencies they pin, and their lockfile
 * entries to the same release commit. The GitHub release carries no assets: the build the preflight ran predates
 * the bump, so a tarball packed here would carry the previous version, and the packages are distributed through
 * NPM, which `.github/workflows/publish-npm.yml` publishes to from a fresh build.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import {
  parseVersionArguments,
  updateVersion
} from '@mnaoumov/typescript-dev-toolkit/version';
import process from 'node:process';

import { setWorkspacePackageVersions } from './helpers/workspace-release.ts';

await wrapCliTask(async () => {
  const [, , ...versionArguments] = process.argv;
  const { options, versionUpdateType } = parseVersionArguments(versionArguments);
  await updateVersion(versionUpdateType, {
    ...options,
    getReleaseAssetPaths: () => Promise.resolve([]),
    updateVersionInExtraFiles: setWorkspacePackageVersions
  });
});
