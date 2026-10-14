/**
 * @file
 *
 * The joint release of the workspace packages: one version for all five, bumped together and published together.
 *
 * The packages share one version line on purpose (see `AGENTS.md`), so the release bumps every package and every
 * dependency one of them declares on a sibling in the same step, and the NPM publish ships each of them in
 * dependency order.
 */

import type { PackageJson } from 'type-fest';

import {
  editPackageJson,
  editPackageLockJson,
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
 * The dependency maps of a `package.json` that can name a sibling workspace package.
 */
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const;

/**
 * The license file every package's `files` list names. Only the root carries one, so it is copied in at publish
 * time.
 */
const LICENSE_FILE_NAME = 'LICENSE';

/**
 * Sets every dependency a manifest declares on one of the given packages to the given version.
 *
 * @param dependencyMaps - The manifest, or a `package-lock.json` entry, whose dependency maps are rewritten in place.
 * @param packageNames - The names of the sibling workspace packages.
 * @param version - The version to pin them to.
 */
export function pinSiblingDependencies(dependencyMaps: Partial<Record<(typeof DEPENDENCY_FIELDS)[number], unknown>>, packageNames: ReadonlySet<string>, version: string): void {
  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = dependencyMaps[field];
    if (typeof dependencies !== 'object' || dependencies === null) {
      continue;
    }
    const record = dependencies as Record<string, unknown>;
    for (const name of Object.keys(record)) {
      if (packageNames.has(name)) {
        record[name] = version;
      }
    }
  }
}

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
 * Sets the version of every workspace package, and of every dependency one of them declares on a sibling, in their
 * own manifests and in the root `package-lock.json`. The root manifest and the lockfile's root entry are the generic
 * release's job.
 *
 * @param newVersion - The version being released.
 * @returns A {@link Promise} that resolves when every file is updated.
 */
export async function setWorkspacePackageVersions(newVersion: string): Promise<void> {
  const folders = await getWorkspaceFolders();
  const packageNames = new Set<string>();
  for (const folder of folders) {
    const { name } = await readPackageJson(folder);
    if (name) {
      packageNames.add(name);
    }
  }

  for (const folder of folders) {
    await editPackageJson((packageJson) => {
      packageJson.version = newVersion;
      pinSiblingDependencies(packageJson, packageNames, newVersion);
    }, { cwd: folder });
  }

  await editPackageLockJson((packageLockJson) => {
    for (const folder of folders) {
      const entry = packageLockJson.packages?.[folder];
      if (!entry) {
        continue;
      }
      entry.version = newVersion;
      pinSiblingDependencies(entry, packageNames, newVersion);
    }
  }, { shouldSkipIfMissing: true });
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
