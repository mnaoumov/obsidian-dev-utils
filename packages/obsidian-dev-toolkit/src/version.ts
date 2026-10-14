/**
 * @file
 *
 * Releases an Obsidian plugin: the generic release from `@mnaoumov/typescript-dev-toolkit/version`, plus what only a
 * plugin has — `manifest.json` (and `manifest-beta.json` for a pre-release) and `versions.json` bumped with the
 * plugin's `minAppVersion`, the updated manifest copied into `dist/build`, the demo vault archived as a release
 * asset, and the files in `dist/build` attached to the GitHub release instead of an `npm pack` tarball.
 */

import type {
  ParsedVersionArguments as GenericParsedVersionArguments,
  UpdateVersionOptions as GenericUpdateVersionOptions
} from '@mnaoumov/typescript-dev-toolkit/version';

import { readdirPosix } from '@mnaoumov/typescript-dev-toolkit/fs';
import { editJson } from '@mnaoumov/typescript-dev-toolkit/json';
import { resolvePathFromRootSafe } from '@mnaoumov/typescript-dev-toolkit/root';
import {
  isPreRelease,
  toUpdateVersionOptions,
  updateVersion as updateVersionGeneric,
  VERSION_ARGUMENT_OPTIONS
} from '@mnaoumov/typescript-dev-toolkit/version';
import { join } from '@mnaoumov/typescript-lib/path';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { existsSync } from 'node:fs';
import {
  cp,
  rm
} from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { archivePluginDemoVault } from './demo-vault.ts';
import { ObsidianPluginRepoPaths } from './obsidian-plugin-repo-paths.ts';

/**
 * Type representing the structure of Obsidian's `desktop-releases.json` feed.
 *
 * This is the feed the desktop app itself updates from, so it is the only source that states a version
 * desktop users can actually run.
 */
export interface DesktopReleasesJson {
  /**
   * The latest Obsidian version available for desktop.
   */
  latestVersion: string;
}

/**
 * Type representing the manifest file format for Obsidian plugins.
 */
export interface Manifest {
  /**
   * A minimum Obsidian version required for the plugin.
   */
  minAppVersion: string;

  /**
   * A version of the plugin.
   */
  version: string;
}
/**
 * The result of parsing the command-line arguments for a plugin release.
 */
export interface ParsedVersionArguments extends GenericParsedVersionArguments {
  /**
   * The {@link UpdateVersionOptions} parsed from the flags.
   */
  readonly options: UpdateVersionOptions;
}

/**
 * Options for {@link updateVersion}: the generic release options plus the plugin's own.
 */
export interface UpdateVersionOptions extends GenericUpdateVersionOptions {
  /**
   * An explicit `minAppVersion` to write into the plugin's `manifest.json` and its new `versions.json`
   * entry. When set, it is used verbatim and the latest Obsidian desktop version is not fetched at all.
   *
   * Set this when the plugin has a known minimum it actually requires, rather than tracking whatever
   * Obsidian released most recently. Only applies to non-pre-release versions (a pre-release copies the
   * existing `manifest.json` and never writes `minAppVersion`).
   *
   * @default the latest Obsidian desktop version
   */
  readonly minAppVersion?: string | undefined;

  /**
   * Whether to archive the plugin's demo vault (`demo-vault/` in the repo root) as a release artifact. Ignored
   * when the repo has no `demo-vault/` folder.
   *
   * @default `true`
   */
  readonly shouldArchiveDemoVault?: boolean;
}

/**
 * The feed the Obsidian desktop app updates from.
 *
 * Deliberately NOT the GitHub `releases/latest` API: that endpoint returns the newest release of any kind
 * in `obsidianmd/obsidian-releases`, including one whose only asset is the Android APK, which no desktop
 * user can install. See {@link getLatestObsidianVersion}.
 */
const DESKTOP_RELEASES_JSON_URL = 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/desktop-releases.json';

/**
 * Copies the updated manifest file to the distribution build folder.
 *
 * @returns A {@link Promise} that resolves when the copy operation is complete.
 */
export async function copyUpdatedManifest(): Promise<void> {
  await cp(
    resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.ManifestJson }),
    resolvePathFromRootSafe({ path: join(ObsidianPluginRepoPaths.DistBuild, ObsidianPluginRepoPaths.ManifestJson) }),
    { force: true }
  );
}

/**
 * Parses the command-line arguments for a plugin release: every flag the generic `parseVersionArguments`
 * recognizes, plus two of the plugin's own:
 * - `--min-app-version=<x.y.z>` — write this `minAppVersion` into the plugin's `manifest.json` and its new
 *   `versions.json` entry instead of tracking the latest Obsidian desktop version.
 * - `--no-demo-vault` — skip archiving the plugin's demo vault (`demo-vault/`) as a release artifact.
 *
 * @param $arguments - The command-line arguments to parse (typically `process.argv.slice(2)`).
 * @returns The {@link ParsedVersionArguments} containing the version update type and the options.
 */
export function parseVersionArguments($arguments: string[]): ParsedVersionArguments {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    // eslint-disable-next-line unicorn/name-replacements -- `args` is the option name Node's `parseArgs` reads.
    args: $arguments,
    options: {
      ...VERSION_ARGUMENT_OPTIONS,
      'min-app-version': { type: 'string' },
      'no-demo-vault': { type: 'boolean' }
    }
  });

  return {
    options: {
      ...toUpdateVersionOptions(values),
      minAppVersion: values['min-app-version'],
      shouldArchiveDemoVault: !(values['no-demo-vault'] ?? false)
    },
    versionUpdateType: positionals[0]
  };
}

/**
 * Releases the plugin. See the `@file` overview for what it adds to the generic release.
 *
 * @param versionUpdateType - The type of version update to perform (major, minor, patch, premajor, preminor, prepatch, prerelease, or x.y.z[-suffix]).
 * @param options - The {@link UpdateVersionOptions} controlling the release behavior.
 * @returns A {@link Promise} that resolves when the release is complete.
 */
export async function updateVersion(versionUpdateType?: string, options: UpdateVersionOptions = {}): Promise<void> {
  const {
    minAppVersion,
    prepareGitHubRelease,
    shouldArchiveDemoVault = true,
    ...genericOptions
  } = options;

  await updateVersionGeneric(versionUpdateType, {
    ...genericOptions,
    getReleaseAssetPaths: getPluginReleaseAssetPaths,
    async prepareGitHubRelease(newVersion: string): Promise<void> {
      await prepareGitHubRelease?.(newVersion);
      if (shouldArchiveDemoVault) {
        await archivePluginDemoVault();
      }
    },
    async updateVersionInExtraFiles(newVersion: string): Promise<void> {
      await updateVersionInFilesForPlugin(newVersion, minAppVersion);
    }
  });
}

/**
 * Fetches the latest version of Obsidian that the desktop app can actually run.
 *
 * Reads {@link DESKTOP_RELEASES_JSON_URL}, not the GitHub `releases/latest` API. The API returns the newest
 * release of ANY kind, so whenever a mobile-only release (an APK-only asset) is newer than the desktop one,
 * it reports a version that does not exist for desktop. A plugin released in that window gets a
 * `minAppVersion` no desktop user can satisfy, and Obsidian silently keeps offering them the previous
 * release instead — the release succeeds and reaches nobody.
 *
 * @returns A {@link Promise} that resolves to the latest Obsidian version available for desktop.
 */
async function getLatestObsidianVersion(): Promise<string> {
  // eslint-disable-next-line no-restricted-globals -- We run this outside of Obsidian, so we don't have `requestUrl()`.
  const response = await fetch(DESKTOP_RELEASES_JSON_URL);
  const desktopReleasesJson = await response.json() as Partial<DesktopReleasesJson>;
  return ensureNonNullable(desktopReleasesJson.latestVersion, 'Could not find the latest desktop Obsidian version');
}
/**
 * The plugin's release assets: every file in `dist/build`.
 *
 * @returns The asset paths.
 */
async function getPluginReleaseAssetPaths(): Promise<string[]> {
  const buildFolder = resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.DistBuild });
  const fileNames = await readdirPosix(buildFolder);
  return fileNames.map((fileName) => join(buildFolder, fileName));
}

async function updateVersionInFilesForPlugin(newVersion: string, minAppVersion: string | undefined): Promise<void> {
  const manifestBetaJsonPath = resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.ManifestBetaJson });
  if (isPreRelease(newVersion)) {
    await cp(
      resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.ManifestJson }),
      manifestBetaJsonPath,
      { force: true }
    );
    await editJson<Manifest>({
      editFunction: (manifest) => {
        manifest.version = newVersion;
      },
      path: ObsidianPluginRepoPaths.ManifestBetaJson
    });
  } else {
    const resolvedMinAppVersion = minAppVersion ?? await getLatestObsidianVersion();

    await editJson<Manifest>({
      editFunction: (manifest) => {
        manifest.minAppVersion = resolvedMinAppVersion;
        manifest.version = newVersion;
      },
      path: ObsidianPluginRepoPaths.ManifestJson
    });

    await editJson<Record<string, string>>({
      editFunction: (versions) => {
        versions[newVersion] = resolvedMinAppVersion;
      },
      path: ObsidianPluginRepoPaths.VersionsJson
    });

    if (existsSync(manifestBetaJsonPath)) {
      await rm(manifestBetaJsonPath);
    }
  }

  await copyUpdatedManifest();
}
