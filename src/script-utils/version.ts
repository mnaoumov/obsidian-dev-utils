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
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
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
export interface ParsedVersionArgs {
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
   * Whether to open the generated changelog in the editor for an interactive review. When `false`,
   * the changelog is still generated from commit messages, but it is not opened in the editor for
   * manual review.
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
 * Type representing the structure of Obsidian releases JSON.
 */
export interface ObsidianReleasesJson {
  /**
   * A name of the Obsidian release.
   */
  name: string;
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

  const commitArgs = ['git', 'commit', '-m', `chore: release ${newVersion}`, '--allow-empty'];
  if (!shouldVerifyCommit) {
    commitArgs.push('--no-verify');
  }

  for (;;) {
    try {
      await execFromRoot(['git', 'add', '--all'], { isQuiet: true });
      await execFromRoot(commitArgs, { isQuiet: true });
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
export async function checkGitHubCliInstalled(): Promise<void> {
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
export async function checkGitInstalled(): Promise<void> {
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
export async function checkGitRepoClean(): Promise<void> {
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
  const newVersionEscaped = replaceAll({
    replacer: '\\.',
    searchValue: '.',
    str: newVersion
  });
  const match = new RegExp(`\n## ${newVersionEscaped}\n\n((.|\n)+?)\n\n##`).exec(content);
  /* v8 ignore start -- v8 tracks optional chaining and ternary as separate branches; both paths are tested. */
  let releaseNotes = match?.[1] ? `${match[1]}\n\n` : '';
  /* v8 ignore stop */

  const tags = (await execFromRoot('git tag --sort=-creatordate', { isQuiet: true })).split(/\r?\n/);
  const previousVersion = tags[1];
  let changesUrl: string;

  const repoUrl = await execFromRoot('gh repo view --json url -q .url', { isQuiet: true });

  if (previousVersion) {
    changesUrl = `${repoUrl}/compare/${previousVersion}...${newVersion}`;
  } else {
    changesUrl = `${repoUrl}/commits/${newVersion}`;
  }

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
    case VersionUpdateType.PreRelease:
      return versionUpdateTypeEnum;

    default:
      if (/^\d+\.\d+\.\d+(?:-[\w\d.-]+)?$/.test(versionUpdateType)) {
        return VersionUpdateType.Manual;
      }

      return VersionUpdateType.Invalid;
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
 * Each behavior is enabled by default; the corresponding `--no-*` flag turns it off. Recognized flags:
 * - `--no-build` — skip the build step (only safe when the build output already matches the current code).
 * - `--no-changelog-editing` — generate the changelog without opening it for manual review.
 * - `--no-checks` — skip the clean-repo check, format, spellcheck, lint, over-exposure analysis, and tests (the build still runs).
 * - `--no-commit-verification` — pass `--no-verify` to the release commit, skipping the pre-commit hook.
 * - `--no-demo-vault` — skip archiving the plugin's demo vault (`demo-vault/`) as a release artifact.
 * - `--no-release` — run all local steps but skip the push and the GitHub release.
 *
 * @param args - The command-line arguments to parse (typically `process.argv.slice(2)`).
 * @returns The {@link ParsedVersionArgs} containing the version update type and the options.
 */
export function parseVersionArgs(args: string[]): ParsedVersionArgs {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args,
    options: {
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
 * @param newVersion - The new version number to be added to the changelog.
 * @param options - The {@link UpdateChangelogOptions} controlling the changelog review behavior.
 * @returns A {@link Promise} that resolves when the changelog update is complete.
 */
export async function updateChangelog(newVersion: string, options: UpdateChangelogOptions = {}): Promise<void> {
  const { shouldEditChangelog = true } = options;
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

  const lastTag = replaceAll({
    replacer: '',
    searchValue: '## ',
    str: previousChangelogLines[0] ?? ''
  });
  const commitRange = lastTag ? `${lastTag}..HEAD` : 'HEAD';
  const commitMessagesStr = await execFromRoot(`git log ${commitRange} --format=%B --first-parent -z`, { isQuiet: true });
  const commitMessages = commitMessagesStr.split('\0').filter(Boolean).map(toFirstLine);

  let newChangeLog = `# CHANGELOG\n\n## ${newVersion}\n\n`;

  for (const message of commitMessages) {
    newChangeLog += `- ${message}\n`;
  }

  if (previousChangelogLines.length > 0) {
    newChangeLog += '\n';
    for (const line of previousChangelogLines) {
      newChangeLog += `${line}\n`;
    }
  }

  await writeFile(changelogPath, newChangeLog, 'utf-8');

  if (!shouldEditChangelog) {
    return;
  }

  const codeVersion = await execFromRoot('code --version', {
    isQuiet: true,
    shouldIgnoreExitCode: true
  });
  const versionDebugger = getLibDebugger('Version');
  if (codeVersion) {
    versionDebugger(`Please update the ${ObsidianPluginRepoPaths.ChangelogMd} file. Close Visual Studio Code when you are done...`);
    await execFromRoot(['code', '-w', changelogPath], {
      isQuiet: true,
      shouldIgnoreExitCode: true
    });
  } else {
    versionDebugger('Could not find Visual Studio Code in your PATH. Using console mode instead.');
    await createInterface(process.stdin, process.stdout).question(
      `Please update the ${ObsidianPluginRepoPaths.ChangelogMd} file. Press Enter when you are done...`
    );
  }
}

/**
 * Updates the version of the project based on the specified update type.
 *
 * This function performs a series of tasks to handle version updates:
 * 1. Validates the version update type.
 * 2. Checks if Git and GitHub CLI are installed.
 * 3. Verifies that the Git repository is clean.
 * 4. Runs spellcheck and linting.
 * 5. Builds the project.
 * 6. Updates version in files and changelog.
 * 7. Adds updated files to Git, tags the commit, and pushes to the repository.
 * 8. If an Obsidian plugin, copies the updated manifest and publishes a GitHub release.
 *
 * @param versionUpdateType - The type of version update to perform (major, minor, patch, premajor, preminor, prepatch, prerelease, or x.y.z[-suffix]).
 * @param options - The {@link UpdateVersionOptions} controlling the release behavior.
 * @returns A {@link Promise} that resolves when the version update is complete.
 */
export async function updateVersion(versionUpdateType?: string, options: UpdateVersionOptions = {}): Promise<void> {
  const {
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

  const isObsidianPlugin = existsSync(resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.ManifestJson })) && (await readPackageJson()).name !== 'obsidian-dev-utils';

  validate(versionUpdateType);
  await checkGitInstalled();
  await checkGitHubCliInstalled();

  if (shouldRunChecks) {
    await checkGitRepoClean();
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
  await updateVersionInFiles(newVersion);
  if (isObsidianPlugin) {
    await updateVersionInFilesForPlugin(newVersion);
  }

  await updateChangelog(newVersion, { shouldEditChangelog });
  await addUpdatedFilesToGit(newVersion, { shouldVerifyCommit });
  await addGitTag(newVersion);

  if (!shouldRelease) {
    getLibDebugger('Version')('Skipping git push and GitHub release (--no-release). The version bump, changelog, commit, and tag have been created locally.');
    return;
  }

  await gitPush();
  await prepareGitHubRelease?.(newVersion);
  if (isObsidianPlugin && shouldArchiveDemoVault) {
    await archivePluginDemoVault(newVersion);
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
 * Fetches the latest version of Obsidian from the GitHub releases API.
 *
 * @returns A {@link Promise} that resolves to the latest version of Obsidian.
 */
async function getLatestObsidianVersion(): Promise<string> {
  // eslint-disable-next-line no-restricted-globals -- We run this outside of Obsidian, so we don't have `requestUrl()`.
  const response = await fetch('https://api.github.com/repos/obsidianmd/obsidian-releases/releases/latest');
  const obsidianReleasesJson = await response.json() as Partial<ObsidianReleasesJson>;
  return ensureNonNullable(obsidianReleasesJson.name, 'Could not find the name of the latest Obsidian release');
}

function isPreRelease(version: string): boolean {
  return prerelease(version) !== null;
}

function toFirstLine(str: string): string {
  return str.split(/\r?\n/).filter(Boolean).slice(0, 1).join('');
}

async function updateVersionInFilesForPlugin(newVersion: string): Promise<void> {
  const manifestBetaJsonPath = resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.ManifestBetaJson });
  if (isPreRelease(newVersion)) {
    await cp(
      resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.ManifestJson }),
      manifestBetaJsonPath,
      { force: true }
    );
    await editJson<Manifest>({
      editFn: (manifest) => {
        manifest.version = newVersion;
      },
      path: ObsidianPluginRepoPaths.ManifestBetaJson
    });
  } else {
    const latestObsidianVersion = await getLatestObsidianVersion();

    await editJson<Manifest>({
      editFn: (manifest) => {
        manifest.minAppVersion = latestObsidianVersion;
        manifest.version = newVersion;
      },
      path: ObsidianPluginRepoPaths.ManifestJson
    });

    await editJson<Record<string, string>>({
      editFn: (versions) => {
        versions[newVersion] = latestObsidianVersion;
      },
      path: ObsidianPluginRepoPaths.VersionsJson
    });

    if (existsSync(manifestBetaJsonPath)) {
      await rm(manifestBetaJsonPath);
    }
  }

  await copyUpdatedManifest();
}
