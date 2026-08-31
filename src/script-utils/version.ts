/**
 * @file
 *
 * This module provides functions for managing version updates in a project.
 * It includes tasks such as validating version update types, checking the state
 * of Git and GitHub CLI, updating version numbers in files, and performing
 * Git operations such as tagging and pushing.
 */

import type { ReleaseType } from 'semver';

import { existsSync } from 'node:fs';
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import {
  inc,
  prerelease
} from 'semver';

import type { PackageLockJson } from './npm.ts';

import { getLibDebugger } from '../debug.ts';
import { errorToString } from '../error.ts';
import { ObsidianPluginRepoPaths } from '../obsidian/plugin/obsidian-plugin-repo-paths.ts';
import { join } from '../path.ts';
import { replaceAll } from '../string.ts';
import {
  assertNonNullable,
  ensureNonNullable
} from '../type-guards.ts';
import { archivePluginDemoVault } from './demo-vault.ts';
import { readdirPosix } from './fs.ts';
import { editJson } from './json.ts';
import {
  npmRun,
  npmRunOptional
} from './npm-run.ts';
import {
  editNpmShrinkWrapJson,
  editPackageJson,
  editPackageLockJson,
  readPackageJson
} from './npm.ts';
import { ObsidianDevUtilsRepoPaths } from './obsidian-dev-utils-repo-paths.ts';
import {
  execFromRoot,
  resolvePathFromRootSafe
} from './root.ts';

/**
 * Options for {@link addUpdatedFilesToGit}.
 */
export interface AddUpdatedFilesToGitOptions {
  /**
   * Whether to run the pre-commit hook when creating the release commit. When `false`, `--no-verify`
   * is passed to the release commit to skip the hook.
   *
   * @default `true`
   */
  readonly shouldVerifyCommit?: boolean;
}

/**
 * The result of parsing the command-line arguments for a version update.
 */
export interface ParsedVersionArguments {
  /**
   * The {@link UpdateVersionOptions} parsed from the flags.
   */
  readonly options: UpdateVersionOptions;

  /**
   * The positional version update type argument, or `undefined` if none was provided.
   */
  readonly versionUpdateType: string | undefined;
}

/**
 * Options for {@link updateChangelog}.
 */
export interface UpdateChangelogOptions {
  /**
   * A path to a file whose contents become the body of the new version's changelog section, instead of
   * the bullets derived from the commit messages. Use it to supply prepared release notes from a
   * non-interactive caller (a background process, CI, an agent).
   *
   * Setting it implies no interactive review: the commit log is not read, and the changelog is never
   * opened in the editor nor waited on at the console, regardless of {@link shouldEditChangelog}.
   *
   * @default the first-parent commit subjects since the previous version
   */
  readonly changelogFilePath?: string | undefined;

  /**
   * Whether to open the generated changelog in the editor for an interactive review. When `false`,
   * the changelog is still generated from commit messages, but it is not opened in the editor for
   * manual review.
   *
   * Ignored when {@link changelogFilePath} is set.
   *
   * @default `true`
   */
  readonly shouldEditChangelog?: boolean;
}

/**
 * Options for {@link updateVersion}.
 */
export interface UpdateVersionOptions {
  /**
   * A path to a file whose contents become the body of the new version's changelog section, instead of
   * the bullets derived from the commit messages. Use it to supply prepared release notes from a
   * non-interactive caller (a background process, CI, an agent).
   *
   * Setting it implies no interactive review: the commit log is not read, and the changelog is never
   * opened in the editor nor waited on at the console, regardless of {@link shouldEditChangelog}.
   *
   * @default the first-parent commit subjects since the previous version
   */
  readonly changelogFilePath?: string | undefined;

  /**
   * An explicit `minAppVersion` to write into the plugin's `manifest.json` and its new `versions.json`
   * entry. When set, it is used verbatim and the latest Obsidian desktop version is not fetched at all.
   *
   * Set this when the plugin has a known minimum it actually requires, rather than tracking whatever
   * Obsidian released most recently. Only applies to Obsidian plugins, and only to non-pre-release
   * versions (a pre-release copies the existing `manifest.json` and never writes `minAppVersion`).
   *
   * @default the latest Obsidian desktop version
   */
  readonly minAppVersion?: string | undefined;

  /**
   * A callback function to prepare the GitHub release.
   *
   * @param newVersion - The new version number for the release.
   * @returns A {@link Promise} that resolves when the GitHub release has been prepared.
   */
  prepareGitHubRelease?(this: void, newVersion: string): Promise<void>;

  /**
   * Whether to archive the plugin's demo vault (`demo-vault/` in the repo root) as a release
   * artifact. Only applies to Obsidian plugins; ignored when the repo has no `demo-vault/` folder.
   *
   * @default `true`
   */
  readonly shouldArchiveDemoVault?: boolean;

  /**
   * Whether to run the build step. The build is a publishing prerequisite, not a verification check,
   * so it is governed by this flag independently of {@link shouldRunChecks} — it runs even when the
   * checks are skipped, so a fast release still ships fresh artifacts. Set to `false` only when the
   * build output is known to already match the current code; otherwise the release would publish
   * stale artifacts.
   *
   * @default `true`
   */
  readonly shouldBuild?: boolean;

  /**
   * Whether to open the generated changelog in the editor for an interactive review.
   *
   * Ignored when {@link changelogFilePath} is set. When it is neither set nor disabled, the release
   * requires an interactive terminal, and {@link updateVersion} refuses up front without one rather
   * than blocking on an editor nobody will close.
   *
   * @default `true`
   */
  readonly shouldEditChangelog?: boolean;

  /**
   * Whether to publish the release. When `false`, all local steps are executed (version bump,
   * changelog, commit, tag), but the changes are not pushed and no GitHub release is published.
   *
   * @default `true`
   */
  readonly shouldRelease?: boolean;

  /**
   * Whether to run the preflight verification checks (clean-repo check, format, spellcheck, lint,
   * over-exposure analysis, and tests). The build step is not one of these checks — it is governed
   * separately by {@link shouldBuild}.
   *
   * @default `true`
   */
  readonly shouldRunChecks?: boolean;

  /**
   * Whether to run the pre-commit hook when creating the release commit. When `false`, `--no-verify`
   * is passed to the release commit to skip the hook.
   *
   * @default `true`
   */
  readonly shouldVerifyCommit?: boolean;
}

interface NpmPackResult {
  readonly filename: string;
}

/**
 * The default pre-release identifier used for pre-release versions.
 */
const DEFAULT_PREID = 'beta';

/**
 * The feed the Obsidian desktop app updates from.
 *
 * Deliberately NOT the GitHub `releases/latest` API: that endpoint returns the newest release of any kind
 * in `obsidianmd/obsidian-releases`, including one whose only asset is the Android APK, which no desktop
 * user can install. See {@link getLatestObsidianVersion}.
 */
const DESKTOP_RELEASES_JSON_URL = 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/desktop-releases.json';

/**
 * Enum representing different types of version updates.
 *
 * Aligns with npm's `npm version` increment types plus `Manual` for explicit versions.
 */
export enum VersionUpdateType {
  Invalid = 'invalid',
  Major = 'major',
  Manual = 'manual',
  Minor = 'minor',
  Patch = 'patch',
  PreMajor = 'premajor',
  PreMinor = 'preminor',
  PrePatch = 'prepatch',
  PreRelease = 'prerelease'
}

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
 * Creates a Git tag for the new version.
 *
 * @param newVersion - The new version number to use for the tag.
 * @returns A {@link Promise} that resolves when the tag has been created.
 */
export async function addGitTag(newVersion: string): Promise<void> {
  await execFromRoot(`git tag -a ${newVersion} -m ${newVersion} --force`, { isQuiet: true });
}

/**
 * Adds updated files to the Git staging area and commits them with the new version message.
 *
 * If the commit fails (for example, the pre-commit hook rejects a new word in the changelog) and the
 * process is attached to an interactive terminal, the user is prompted to fix the issue (for example,
 * add the missing word to `cspell.json`) and press Enter to retry. The retry re-stages all files, so the
 * fix is picked up without restarting the whole release lifecycle. In a non-interactive environment (no
 * TTY, such as CI), the error is re-thrown instead of prompting, so the script fails fast rather than
 * hanging. Pass `shouldVerifyCommit: false` to skip the pre-commit hook entirely in such cases.
 *
 * @param newVersion - The new version number used as the commit message.
 * @param options - The {@link AddUpdatedFilesToGitOptions} controlling the commit behavior.
 * @returns A {@link Promise} that resolves when the files have been added and committed.
 */
export async function addUpdatedFilesToGit(newVersion: string, options: AddUpdatedFilesToGitOptions = {}): Promise<void> {
  const { shouldVerifyCommit = true } = options;
  const versionDebugger = getLibDebugger('Version');

  const commitArguments = ['git', 'commit', '-m', `chore: release ${newVersion}`, '--allow-empty'];
  if (!shouldVerifyCommit) {
    commitArguments.push('--no-verify');
  }

  for (;;) {
    try {
      await execFromRoot(['git', 'add', '--all'], { isQuiet: true });
      await execFromRoot(commitArguments, { isQuiet: true });
      return;
    } catch (error) {
      if (!process.stdin.isTTY) {
        throw error;
      }

      versionDebugger(
        `Failed to commit the release.\n${errorToString(error)}\n`
          + 'Fix the issues (for example, add the missing word to cspell.json) and press Enter to retry the commit, or Ctrl+C to abort.'
      );
      await createInterface(process.stdin, process.stdout).question('Press Enter to retry the commit...');
    }
  }
}

/**
 * Checks if the GitHub CLI is installed on the system.
 *
 * Throws an error if the GitHub CLI is not installed.
 *
 * @throws Error if the GitHub CLI is not installed.
 */
export async function assertGitHubCliInstalled(): Promise<void> {
  try {
    await execFromRoot('gh --version', { isQuiet: true });
  } catch {
    throw new Error('GitHub CLI is not installed. Please install it from https://cli.github.com/');
  }
}

/**
 * Checks if Git is installed on the system.
 *
 * Throws an error if Git is not installed.
 *
 * @throws Error if Git is not installed.
 */
export async function assertGitInstalled(): Promise<void> {
  try {
    await execFromRoot('git --version', { isQuiet: true });
  } catch {
    throw new Error('Git is not installed. Please install it from https://git-scm.com/');
  }
}

/**
 * Checks if the Git repository is clean, meaning there are no uncommitted changes.
 *
 * Throws an error if the Git repository is not clean.
 *
 * @throws Error if the Git repository is not clean.
 */
export async function assertGitRepoClean(): Promise<void> {
  try {
    const stdout = await execFromRoot('git status --porcelain --untracked-files=all', { isQuiet: true });
    if (stdout) {
      throw new Error();
    }
  } catch {
    throw new Error('Git repository is not clean. Please commit or stash your changes before releasing a new version.');
  }
}

/**
 * Wraps any bare `http(s)://` URL in the given text in angle brackets (`<url>`) so that text emitted
 * into a Markdown document (such as a generated changelog bullet) passes markdownlint's
 * `MD034/no-bare-urls` rule while still rendering as a clickable autolink on GitHub.
 *
 * URLs that are already wrapped in angle brackets (`<url>`) or that form the target of a Markdown
 * link (`[text](url)`) are left untouched, so the function is safe to run repeatedly. Trailing
 * sentence punctuation (`.`, `,`, `;`, `:`, `!`, `?`) is kept outside the angle brackets so it does
 * not become part of the link.
 *
 * @param text - The text possibly containing bare URLs.
 * @returns The text with every bare URL wrapped in angle brackets.
 */
export function autolinkBareUrls(text: string): string {
  return text.replaceAll(/(?<![<[(])https?:\/\/[^\s<>)\]]+/g, (url) => {
    const trailingPunctuation = /[.,;:!?]+$/.exec(url)?.[0] ?? '';
    const bareUrl = url.slice(0, url.length - trailingPunctuation.length);
    return `<${bareUrl}>${trailingPunctuation}`;
  });
}

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
 * Generates a new version string based on the current version and the specified update type.
 *
 * Uses the `semver` package to compute the next version, supporting all npm increment types:
 * `major`, `minor`, `patch`, `premajor`, `preminor`, `prepatch`, and `prerelease`.
 * Pre-release versions use the `beta` identifier by default (e.g., `1.2.4-beta.0`).
 *
 * @param versionUpdateType - The type of version update or an explicit version string.
 * @returns A {@link Promise} that resolves to the new version string.
 * @throws Error if the current version is invalid or the increment fails.
 */
export async function getNewVersion(versionUpdateType: string): Promise<string> {
  const versionType = getVersionUpdateType(versionUpdateType);
  if (versionType === VersionUpdateType.Manual) {
    return versionUpdateType;
  }

  const packageJson = await readPackageJson();
  const currentVersion = packageJson.version ?? '';

  const releaseType = versionType as ReleaseType;
  const isPreReleaseType = releaseType.startsWith('pre');
  const newVersion = isPreReleaseType
    ? inc(currentVersion, releaseType, DEFAULT_PREID)
    : inc(currentVersion, releaseType);
  assertNonNullable(newVersion, `Failed to increment version from '${currentVersion}' with type '${versionType}'`);

  return newVersion;
}

/**
 * Retrieves the release notes for a specific version from the changelog.
 *
 * @param newVersion - The new version number for which to get the release notes.
 * @returns A {@link Promise} that resolves to the release notes for the specified version.
 */
export async function getReleaseNotes(newVersion: string): Promise<string> {
  const changelogPath = resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.ChangelogMd });
  const content = await readFile(changelogPath, 'utf-8');
  const section = extractChangelogSection(content, newVersion);
  let releaseNotes = section ? `${section}\n\n` : '';

  const tagOutput = await execFromRoot('git tag --sort=-creatordate', { isQuiet: true });
  const tags = tagOutput.split(/\r?\n/);
  const previousVersion = tags[1];

  const repoUrl = await execFromRoot('gh repo view --json url -q .url', { isQuiet: true });

  const changesUrl = previousVersion ? `${repoUrl}/compare/${previousVersion}...${newVersion}` : `${repoUrl}/commits/${newVersion}`;

  releaseNotes += `**Full Changelog**: ${changesUrl}`;
  return releaseNotes;
}

/**
 * Determines the type of version update based on the input string.
 *
 * @param versionUpdateType - The input string representing the version update type.
 * @returns The corresponding `VersionUpdateType`.
 */
export function getVersionUpdateType(versionUpdateType: string): VersionUpdateType {
  const versionUpdateTypeEnum = versionUpdateType as VersionUpdateType;
  switch (versionUpdateTypeEnum) {
    case VersionUpdateType.Major:
    case VersionUpdateType.Minor:
    case VersionUpdateType.Patch:
    case VersionUpdateType.PreMajor:
    case VersionUpdateType.PreMinor:
    case VersionUpdateType.PrePatch:
    case VersionUpdateType.PreRelease: {
      return versionUpdateTypeEnum;
    }

    default: {
      if (/^\d+\.\d+\.\d+(?:-[\w\d.-]+)?$/.test(versionUpdateType)) {
        return VersionUpdateType.Manual;
      }

      return VersionUpdateType.Invalid;
    }
  }
}

/**
 * Pushes commits and tags to the remote Git repository.
 *
 * @returns A {@link Promise} that resolves when the push operation is complete.
 */
export async function gitPush(): Promise<void> {
  await execFromRoot('git push --follow-tags --force', { isQuiet: true });
}

/**
 * Parses the command-line arguments for a version update into a version update type and
 * {@link UpdateVersionOptions}.
 *
 * Each behavior is enabled by default; the corresponding `--no-*` flag turns it off. `--changelog-file` and
 * `--min-app-version` take a value instead and have no default. Recognized flags:
 * - `--changelog-file=<path>` — use this file's contents as the new version's changelog section instead of
 *   the commit-derived bullets, and skip the interactive review entirely.
 * - `--min-app-version=<x.y.z>` — write this `minAppVersion` into the plugin's `manifest.json` and its new
 *   `versions.json` entry instead of tracking the latest Obsidian desktop version.
 * - `--no-build` — skip the build step (only safe when the build output already matches the current code).
 * - `--no-changelog-editing` — generate the changelog without opening it for manual review.
 * - `--no-checks` — skip the clean-repo check, format, spellcheck, lint, over-exposure analysis, and tests (the build still runs).
 * - `--no-commit-verification` — pass `--no-verify` to the release commit, skipping the pre-commit hook.
 * - `--no-demo-vault` — skip archiving the plugin's demo vault (`demo-vault/`) as a release artifact.
 * - `--no-release` — run all local steps but skip the push and the GitHub release.
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
      'changelog-file': { type: 'string' },
      'min-app-version': { type: 'string' },
      'no-build': { type: 'boolean' },
      'no-changelog-editing': { type: 'boolean' },
      'no-checks': { type: 'boolean' },
      'no-commit-verification': { type: 'boolean' },
      'no-demo-vault': { type: 'boolean' },
      'no-release': { type: 'boolean' }
    }
  });

  return {
    options: {
      changelogFilePath: values['changelog-file'],
      minAppVersion: values['min-app-version'],
      shouldArchiveDemoVault: !(values['no-demo-vault'] ?? false),
      shouldBuild: !(values['no-build'] ?? false),
      shouldEditChangelog: !(values['no-changelog-editing'] ?? false),
      shouldRelease: !(values['no-release'] ?? false),
      shouldRunChecks: !(values['no-checks'] ?? false),
      shouldVerifyCommit: !(values['no-commit-verification'] ?? false)
    },
    versionUpdateType: positionals[0]
  };
}

/**
 * Publishes a GitHub release for the new version.
 *
 * Handles the creation of a release and uploading files for either an Obsidian plugin or another project.
 *
 * @param newVersion - The new version number for the release.
 * @param isObsidianPlugin - A boolean indicating if the project is an Obsidian plugin.
 * @returns A {@link Promise} that resolves when the release has been published.
 */
export async function publishGitHubRelease(newVersion: string, isObsidianPlugin: boolean): Promise<void> {
  let filePaths: string[];

  if (isObsidianPlugin) {
    const buildFolder = resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.DistBuild });
    const fileNames = await readdirPosix(buildFolder);
    filePaths = fileNames.map((fileName) => join(buildFolder, fileName));
  } else {
    let resultOutput = await execFromRoot(['npm', 'pack', '--pack-destination', ObsidianDevUtilsRepoPaths.Dist, '--json'], { isQuiet: true });
    const index = resultOutput.indexOf('[\n  {');
    if (index === -1) {
      throw new Error('Failed to find the start of the JSON array in the result output');
    }
    resultOutput = resultOutput.slice(index);
    const result = JSON.parse(resultOutput) as [NpmPackResult];
    filePaths = [
      join(ObsidianDevUtilsRepoPaths.Dist, result[0].filename),
      join(ObsidianDevUtilsRepoPaths.Dist, ObsidianDevUtilsRepoPaths.StylesCss)
    ];
  }

  filePaths = filePaths.filter((filePath) => existsSync(resolvePathFromRootSafe({ path: filePath })));

  await execFromRoot([
    'gh',
    'release',
    'create',
    newVersion,
    ...filePaths,
    '--title',
    `v${newVersion}`,
    ...(isPreRelease(newVersion) ? ['--prerelease'] : []),
    '--notes-file',
    '-'
  ], {
    isQuiet: true,
    stdin: await getReleaseNotes(newVersion)
  });
}

/**
 * Updates the changelog file with new version information and commit messages.
 *
 * This function reads the current changelog, appends new entries for the latest version,
 * and prompts the user to review the changes.
 *
 * The review happens on a scratch copy in the OS temporary folder, and the repository's own
 * `CHANGELOG.md` is written only once the review is over — so interrupting the review leaves the
 * repository untouched.
 *
 * @param newVersion - The new version number to be added to the changelog.
 * @param options - The {@link UpdateChangelogOptions} controlling the changelog review behavior.
 * @returns A {@link Promise} that resolves when the changelog update is complete.
 */
export async function updateChangelog(newVersion: string, options: UpdateChangelogOptions = {}): Promise<void> {
  await writeChangelog(await prepareChangelog(newVersion, options));
}

/**
 * Updates the version of the project based on the specified update type.
 *
 * This function performs a series of tasks to handle version updates:
 * 1. Validates the version update type.
 * 2. Checks if Git and GitHub CLI are installed.
 * 3. Verifies that the interactive changelog review, if one is due, can actually be answered.
 * 4. Verifies that the Git repository is clean.
 * 5. Runs spellcheck and linting.
 * 6. Builds the project.
 * 7. Settles the changelog — the only step that can block on a human, and deliberately the last one before
 *    anything is written, so an interrupt here leaves the working tree clean and the release re-runnable.
 * 8. Updates version in files, then writes the settled changelog.
 * 9. Adds updated files to Git, tags the commit, and pushes to the repository.
 * 10. If an Obsidian plugin, copies the updated manifest and publishes a GitHub release.
 *
 * @param versionUpdateType - The type of version update to perform (major, minor, patch, premajor, preminor, prepatch, prerelease, or x.y.z[-suffix]).
 * @param options - The {@link UpdateVersionOptions} controlling the release behavior.
 * @returns A {@link Promise} that resolves when the version update is complete.
 */
export async function updateVersion(versionUpdateType?: string, options: UpdateVersionOptions = {}): Promise<void> {
  const {
    changelogFilePath,
    minAppVersion,
    prepareGitHubRelease,
    shouldArchiveDemoVault = true,
    shouldBuild = true,
    shouldEditChangelog = true,
    shouldRelease = true,
    shouldRunChecks = true,
    shouldVerifyCommit = true
  } = options;

  if (!versionUpdateType) {
    const npmOldVersion = process.env['npm_old_version'];
    const npmNewVersion = process.env['npm_new_version'];

    if (npmOldVersion && npmNewVersion) {
      await updateVersionInFiles(npmOldVersion);
      await updateVersion(npmNewVersion, options);
      return;
    }

    throw new Error('No version update type provided');
  }

  let isObsidianPlugin = false;
  if (existsSync(resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.ManifestJson }))) {
    const packageJson = await readPackageJson();
    isObsidianPlugin = packageJson.name !== 'obsidian-dev-utils';
  }

  validate(versionUpdateType);
  await assertGitInstalled();
  await assertGitHubCliInstalled();
  // Checked here, before the checks and the build, rather than at the changelog step itself: a non-interactive
  // Caller learns in seconds instead of paying for the whole preflight and only then blocking on an editor
  // Window nobody will ever close.
  assertChangelogStepIsNonBlocking(changelogFilePath, shouldEditChangelog);

  if (shouldRunChecks) {
    await assertGitRepoClean();
    await npmRun('format:check');
    await npmRun('spellcheck');
    await npmRun('lint:md');
  }

  // The build is a prerequisite for publishing, not a verification check, so it runs unless `shouldBuild` is `false` — this keeps the released artifacts in sync with the current code even on a fast release.
  if (shouldBuild) {
    await npmRun('build');
  }

  if (shouldRunChecks) {
    await npmRun('lint');
    await npmRunOptional('find-overexposed');
    await npmRunOptional('test');
    await npmRunOptional('test:integration');
    await npmRunOptional('test:coverage');
  }

  const newVersion = await getNewVersion(versionUpdateType);

  // The changelog is settled BEFORE anything is written, because this is the only step that can block on a
  // Human. Interrupting it therefore leaves the working tree pristine and the whole release re-runnable,
  // Instead of stranding a bumped-but-uncommitted tree that `assertGitRepoClean` then refuses to re-release.
  const newChangeLog = await prepareChangelog(newVersion, {
    changelogFilePath,
    shouldEditChangelog
  });

  await updateVersionInFiles(newVersion);
  if (isObsidianPlugin) {
    await updateVersionInFilesForPlugin(newVersion, minAppVersion);
  }

  await writeChangelog(newChangeLog);
  await addUpdatedFilesToGit(newVersion, { shouldVerifyCommit });
  await addGitTag(newVersion);

  if (!shouldRelease) {
    getLibDebugger('Version')('Skipping git push and GitHub release (--no-release). The version bump, changelog, commit, and tag have been created locally.');
    return;
  }

  await gitPush();
  await prepareGitHubRelease?.(newVersion);
  if (isObsidianPlugin && shouldArchiveDemoVault) {
    await archivePluginDemoVault();
  }
  await publishGitHubRelease(newVersion, isObsidianPlugin);
}

/**
 * Updates the version in various files, including `package.json`, `package-lock.json`,
 * and Obsidian plugin manifests if applicable.
 *
 * @param newVersion - The new version string to update in the files.
 * @returns A {@link Promise} that resolves when the update is complete.
 */
export async function updateVersionInFiles(newVersion: string): Promise<void> {
  await editPackageJson((packageJson) => {
    packageJson.version = newVersion;
  });

  await editPackageLockJson(update, { shouldSkipIfMissing: true });
  await editNpmShrinkWrapJson(update, { shouldSkipIfMissing: true });

  function update(packageLockJson: PackageLockJson): void {
    packageLockJson.version = newVersion;
    const defaultPackage = packageLockJson.packages?.[''];
    if (defaultPackage) {
      defaultPackage.version = newVersion;
    }
  }
}

/**
 * Validates the version update type to ensure it is either a recognized type
 * or a valid manual version string.
 *
 * @param versionUpdateType - The version update type to validate.
 * @throws Error if the version update type is invalid.
 */
export function validate(versionUpdateType: string): void {
  if (getVersionUpdateType(versionUpdateType) === VersionUpdateType.Invalid) {
    throw new Error(
      'Invalid version update type. Please use \'major\', \'minor\', \'patch\', \'premajor\', \'preminor\', \'prepatch\', \'prerelease\', or \'x.y.z[-suffix]\' format.'
    );
  }
}

/**
 * Refuses a release that would have to stop at the interactive changelog review with nobody there to
 * finish it. Called from the preflight so the refusal costs seconds, not the whole check-and-build gate.
 *
 * @param changelogFilePath - The path to the prepared release notes, or `undefined` when there is none.
 * @param shouldEditChangelog - Whether the generated changelog is meant to be reviewed interactively.
 */
function assertChangelogStepIsNonBlocking(changelogFilePath: string | undefined, shouldEditChangelog: boolean): void {
  if (changelogFilePath !== undefined || !shouldEditChangelog || process.stdin.isTTY) {
    return;
  }

  throw new Error(
    'The interactive changelog review needs a terminal, and this process has none, so the release would block forever.'
      + ' Pass `--changelog-file <path>` to supply prepared release notes, or `--no-changelog-editing` to accept the'
      + ' changelog generated from the commit messages as is.'
  );
}

/**
 * Extracts the body of one version's `CHANGELOG.md` section — everything between its `## <version>` heading
 * and whichever comes first, the next `## ` heading or the end of the file.
 *
 * Ending at the end of the file is not an edge case but the normal shape of a FIRST release: sections are
 * prepended, so the newest one is bounded by the previous release only once a previous release exists. The
 * regex this replaced required a trailing `\n\n##`, so every `1.0.0` silently published empty release notes.
 * Terminating on `'## '` WITH its trailing space is what keeps an `###` sub-heading inside the section
 * instead of truncating it there.
 *
 * @param changelogContent - The full contents of `CHANGELOG.md`.
 * @param version - The version whose section to extract.
 * @returns The section body, trimmed, or an empty string when the changelog has no section for that version.
 */
function extractChangelogSection(changelogContent: string, version: string): string {
  const lines = changelogContent.split(/\r?\n/);
  const headingIndex = lines.indexOf(`## ${version}`);
  if (headingIndex === -1) {
    return '';
  }

  const bodyStartIndex = headingIndex + 1;
  const nextHeadingOffset = lines.slice(bodyStartIndex).findIndex((line) => line.startsWith('## '));
  const bodyEndIndex = nextHeadingOffset === -1 ? lines.length : bodyStartIndex + nextHeadingOffset;
  return lines.slice(bodyStartIndex, bodyEndIndex).join('\n').trim();
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

function isPreRelease(version: string): boolean {
  return prerelease(version) !== null;
}

/**
 * Composes the full new `CHANGELOG.md` content — including the interactive review, when one is due —
 * WITHOUT touching the repository. Nothing here writes into the repo, so an interrupt anywhere in the
 * review window (the whole point of the split) leaves the working tree exactly as it was.
 *
 * @param newVersion - The new version number the changelog section is written for.
 * @param options - The {@link UpdateChangelogOptions} controlling where the section body comes from.
 * @returns A {@link Promise} that resolves to the settled `CHANGELOG.md` content.
 */
async function prepareChangelog(newVersion: string, options: UpdateChangelogOptions): Promise<string> {
  const {
    changelogFilePath,
    shouldEditChangelog = true
  } = options;
  const HEADER_LINES_COUNT = 2;
  const changelogPath = resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.ChangelogMd });
  let previousChangelogLines: string[];
  if (existsSync(changelogPath)) {
    const content = await readFile(changelogPath, 'utf-8');
    previousChangelogLines = content.split('\n').slice(HEADER_LINES_COUNT);
    if (previousChangelogLines.at(-1) === '') {
      previousChangelogLines.pop();
    }
  } else {
    previousChangelogLines = [];
  }

  let newChangeLog = `# CHANGELOG\n\n## ${newVersion}\n\n`;

  if (changelogFilePath === undefined) {
    const lastTag = replaceAll({
      $string: previousChangelogLines[0] ?? '',
      replacer: '',
      searchValue: '## '
    });
    const commitRange = lastTag ? `${lastTag}..HEAD` : 'HEAD';
    const commitMessagesString = await execFromRoot(`git log ${commitRange} --format=%B --first-parent -z`, { isQuiet: true });
    const commitMessages = commitMessagesString.split('\0').filter(Boolean).map((commitMessage) => toFirstLine(commitMessage));

    for (const message of commitMessages) {
      newChangeLog += `- ${autolinkBareUrls(message)}\n`;
    }
  } else {
    const preparedNotes = await readFile(changelogFilePath, 'utf-8');
    newChangeLog += `${replaceAll({ $string: preparedNotes, replacer: '\n', searchValue: '\r\n' }).trim()}\n`;
  }

  if (previousChangelogLines.length > 0) {
    newChangeLog += '\n';
    for (const line of previousChangelogLines) {
      newChangeLog += `${line}\n`;
    }
  }

  // Prepared notes are already the reviewed text, so they never open an editor, whatever `shouldEditChangelog` says.
  if (changelogFilePath !== undefined || !shouldEditChangelog) {
    return newChangeLog;
  }

  return await reviewChangelog(newChangeLog);
}

/**
 * Hands the composed changelog to the user for review on a scratch copy outside the repository, and
 * returns whatever they left behind. The scratch folder is removed even when the review fails.
 *
 * @param newChangeLog - The composed `CHANGELOG.md` content to hand over for review.
 * @returns A {@link Promise} that resolves to the reviewed content.
 */
async function reviewChangelog(newChangeLog: string): Promise<string> {
  const scratchFolder = await mkdtemp(join(tmpdir(), 'obsidian-dev-utils-changelog-'));
  const scratchChangelogPath = join(scratchFolder, ObsidianPluginRepoPaths.ChangelogMd);

  try {
    await writeFile(scratchChangelogPath, newChangeLog, 'utf-8');

    const codeVersion = await execFromRoot('code --version', {
      isQuiet: true,
      shouldIgnoreExitCode: true
    });
    const versionDebugger = getLibDebugger('Version');
    if (codeVersion) {
      versionDebugger(`Please update the ${ObsidianPluginRepoPaths.ChangelogMd} file. Close Visual Studio Code when you are done...`);
      await execFromRoot(['code', '-w', scratchChangelogPath], {
        isQuiet: true,
        shouldIgnoreExitCode: true
      });
    } else {
      versionDebugger('Could not find Visual Studio Code in your PATH. Using console mode instead.');
      await createInterface(process.stdin, process.stdout).question(
        `Please update the ${scratchChangelogPath} file. Press Enter when you are done...`
      );
    }

    return await readFile(scratchChangelogPath, 'utf-8');
  } finally {
    await rm(scratchFolder, {
      force: true,
      recursive: true
    });
  }
}

function toFirstLine($string: string): string {
  return $string.split(/\r?\n/).filter(Boolean).slice(0, 1).join('');
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

/**
 * Writes the composed changelog into the repository. Deliberately the last thing the changelog step does,
 * so nothing lands on disk until the content is settled.
 *
 * @param newChangeLog - The settled `CHANGELOG.md` content to write.
 * @returns A {@link Promise} that resolves once the changelog has been written.
 */
async function writeChangelog(newChangeLog: string): Promise<void> {
  await writeFile(resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.ChangelogMd }), newChangeLog, 'utf-8');
}
