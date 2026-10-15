/**
 * @file
 *
 * The one-off `1.0.0` publish of the workspace packages, which ships each of them in dependency order.
 *
 * Each package is released from its own repository after that (see `AGENTS.md`); this publish exists because each
 * package's tooling depends on siblings that are not on npm yet, so only this workspace can build all five.
 */

import type { PackageJson } from 'type-fest';

import {
  readPackageJson,
  writePackageJson
} from '@mnaoumov/typescript-dev-toolkit/npm';
import {
  execFromRoot,
  resolvePathFromRootSafe
} from '@mnaoumov/typescript-dev-toolkit/root';
import { join } from '@mnaoumov/typescript-lib/path';
import { existsSync } from 'node:fs';
import {
  copyFile,
  rm
} from 'node:fs/promises';

import { getWorkspaceFolders } from './workspaces.ts';

/**
 * Parameters for {@link publishWorkspacePackages}.
 */
export interface PublishWorkspacePackagesParams {
  /**
   * Whether to publish under the `beta` dist-tag rather than `latest`.
   */
  readonly isBeta: boolean;
}

/**
 * The export condition that maps every subpath onto the package's TypeScript SOURCE inside this repository.
 *
 * The sources do not ship, so the condition is stripped from the published manifest: a consumer that happened to
 * set the same condition would otherwise resolve onto files the tarball does not contain.
 */
export const SOURCE_EXPORT_CONDITION = '@mnaoumov/source';

/**
 * The license file every package's `files` list names. Only the root carries one, so it is copied in at publish
 * time.
 */
const LICENSE_FILE_NAME = 'LICENSE';

/**
 * Publishes every workspace package to NPM, in dependency order.
 *
 * A package whose version is already on the registry is skipped, so a publish that failed half-way is retried by
 * running it again. For the duration of each publish the package gets the root `LICENSE` and a manifest without the
 * {@link SOURCE_EXPORT_CONDITION} condition; both are put back afterwards.
 *
 * Authentication is not handled here: the publish runs from `.github/workflows/publish-npm.yml`, which each package
 * names as its trusted publisher on npmjs.com.
 *
 * @param params - The {@link PublishWorkspacePackagesParams}.
 * @returns A {@link Promise} that resolves when every package is published.
 */
export async function publishWorkspacePackages(params: PublishWorkspacePackagesParams): Promise<void> {
  const tag = params.isBeta ? 'beta' : 'latest';
  const rootLicensePath = resolvePathFromRootSafe({ path: LICENSE_FILE_NAME });

  for (const folder of await getWorkspaceFolders()) {
    const packageJson = await readPackageJson(folder);
    const { name, version } = packageJson;
    if (!name || !version) {
      throw new Error(`The workspace package in ${folder} declares no name or version.`);
    }

    if (await isPublished(name, version)) {
      console.warn(`${name}@${version} is already on the registry; skipping it.`);
      continue;
    }

    const licensePath = join(folder, LICENSE_FILE_NAME);
    const absoluteLicensePath = resolvePathFromRootSafe({ path: licensePath });
    const shouldRemoveLicense = !existsSync(absoluteLicensePath);
    if (shouldRemoveLicense) {
      await copyFile(rootLicensePath, absoluteLicensePath);
    }

    await writePackageJson(toPublishedManifest(packageJson), folder);
    try {
      await execFromRoot(['npm', 'publish', '--tag', tag], { cwd: folder });
    } finally {
      await writePackageJson(packageJson, folder);
      if (shouldRemoveLicense) {
        await rm(absoluteLicensePath, { force: true });
      }
    }
  }
}

/**
 * Returns the manifest a workspace package is published with: the same manifest without the
 * {@link SOURCE_EXPORT_CONDITION} condition anywhere in its `exports` map.
 *
 * @param packageJson - The manifest in the repository.
 * @returns A new manifest; the argument is not changed.
 */
export function toPublishedManifest(packageJson: PackageJson): PackageJson {
  const published: PackageJson = { ...packageJson };
  if (packageJson.exports !== undefined) {
    published.exports = stripSourceCondition(packageJson.exports) as NonNullable<PackageJson['exports']>;
  }
  return published;
}

async function isPublished(name: string, version: string): Promise<boolean> {
  try {
    const output = await execFromRoot(['npm', 'view', `${name}@${version}`, 'version'], { isQuiet: true });
    return output.trim() === version;
  } catch {
    return false;
  }
}

function stripSourceCondition(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripSourceCondition(item));
  }
  return typeof value !== 'object' || value === null
    ? value
    : Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== SOURCE_EXPORT_CONDITION)
        .map(([key, child]) => [key, stripSourceCondition(child)])
    );
}
