/**
 * @packageDocumentation version
 * This module provides functions for managing version updates in a project.
 * It includes tasks such as validating version update types, checking the state
 * of Git and GitHub CLI, updating version numbers in files, and performing
 * Git operations such as tagging and pushing.
 *
 * The main function, `updateVersion`, coordinates these tasks to ensure that
 * version updates are handled consistently and correctly. It also integrates
 * with Obsidian plugins, if applicable, by updating relevant files and releasing
 * new versions on GitHub.
 */

import AdmZip from 'adm-zip';

import { ObsidianPluginRepoPaths } from '../obsidian/Plugin/ObsidianPluginRepoPaths.ts';
import { join } from '../Path.ts';
import { readdirPosix } from './Fs.ts';
import { editJson } from './JSON.ts';
import {
  cp,
  createInterface,
  existsSync,
  readFile,
  writeFile
} from './NodeModules.ts';
import {
  editNpmPackage,
  editNpmPackageLock,
  readNpmPackage
} from './Npm.ts';
import { ObsidianDevUtilsRepoPaths } from './ObsidianDevUtilsRepoPaths.ts';
import {
  execFromRoot,
  resolvePathFromRoot
} from './Root.ts';

/**
 * Enum representing different types of version updates.
 */
export enum VersionUpdateType {
  Major = 'major',
  Minor = 'minor',
  Patch = 'patch',
  Beta = 'beta',
  Manual = 'manual',
  Invalid = 'invalid'
}

/**
 * Type representing the manifest file format for Obsidian plugins.
 */
export interface Manifest {
  /**
   * The minimum Obsidian version required for the plugin.
   */
  minAppVersion: string;

  /**
   * The version of the plugin.
   */
  version: string;
}

/**
 * Type representing the structure of Obsidian releases JSON.
 */
export interface ObsidianReleasesJson {
  /**
   * The name of the Obsidian release.
   */
  name: string;
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
 * @param versionUpdateType - The type of version update to perform (major, minor, patch, beta, or x.y.z[-beta:u]).
 * @returns A promise that resolves when the version update is complete.
 */
export async function updateVersion(versionUpdateType: string): Promise<void> {
  if (!versionUpdateType) {
    const npmOldVersion = process.env['npm_old_version'];
    const npmNewVersion = process.env['npm_new_version'];

    if (npmOldVersion && npmNewVersion) {
      await updateVersionInFiles(npmOldVersion, false);
      await updateVersion(npmNewVersion);
      return;
    }
  }

  const isObsidianPlugin = existsSync(resolvePathFromRoot(ObsidianPluginRepoPaths.ManifestJson));
  validate(versionUpdateType);
  await checkGitInstalled();
  await checkGitRepoClean();
  await checkGitHubCliInstalled();
  await execFromRoot('npm run spellcheck');
  await execFromRoot('npm run build');
  await execFromRoot('npm run lint');

  const newVersion = await getNewVersion(versionUpdateType);
  await updateVersionInFiles(newVersion, isObsidianPlugin);
  await updateChangelog(newVersion);
  await addUpdatedFilesToGit(newVersion);
  await addGitTag(newVersion);
  await gitPush();
  if (isObsidianPlugin) {
    await copyUpdatedManifest();
  }
  await publishGitHubRelease(newVersion, isObsidianPlugin);
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
    throw new Error('Invalid version update type. Please use \'major\', \'minor\', \'patch\', or \'x.y.z[-suffix]\' format.');
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
    await execFromRoot('git --version', { quiet: true });
  } catch {
    throw new Error('Git is not installed. Please install it from https://git-scm.com/');
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
    await execFromRoot('gh --version', { quiet: true });
  } catch {
    throw new Error('GitHub CLI is not installed. Please install it from https://cli.github.com/');
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
    const stdout = await execFromRoot('git status --porcelain --untracked-files=all', { quiet: true });
    if (stdout) {
      throw new Error();
    }
  } catch {
    throw new Error('Git repository is not clean. Please commit or stash your changes before releasing a new version.');
  }
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
    case VersionUpdateType.Beta:
      return versionUpdateTypeEnum;

    default:
      if (/^\d+\.\d+\.\d+(-[\w\d.-]+)?$/.test(versionUpdateType)) {
        return VersionUpdateType.Manual;
      }

      return VersionUpdateType.Invalid;
  }
}

/**
 * Updates the version in various files, including `package.json`, `package-lock.json`,
 * and Obsidian plugin manifests if applicable.
 *
 * @param newVersion - The new version string to update in the files.
 * @param isObsidianPlugin - Whether the project is an Obsidian plugin.
 * @returns A `Promise` that resolves when the update is complete.
 */
export async function updateVersionInFiles(newVersion: string, isObsidianPlugin: boolean): Promise<void> {
  await editNpmPackage((npmPackage) => {
    npmPackage.version = newVersion;
  });

  await editNpmPackageLock((npmPackageLock) => {
    npmPackageLock.version = newVersion;
    const defaultPackage = npmPackageLock.packages?.[''];
    if (defaultPackage) {
      defaultPackage.version = newVersion;
    }
  }, { skipIfMissing: true });

  if (isObsidianPlugin) {
    const latestObsidianVersion = await getLatestObsidianVersion();

    await editJson<Manifest>(ObsidianPluginRepoPaths.ManifestJson, (manifest) => {
      manifest.minAppVersion = latestObsidianVersion;
      manifest.version = newVersion;
    });

    await editJson<Record<string, string>>(ObsidianPluginRepoPaths.VersionsJson, (versions) => {
      versions[newVersion] = latestObsidianVersion;
    });
  }
}

/**
 * Generates a new version string based on the current version and the specified update type.
 *
 * @param versionUpdateType - The type of version update (major, minor, patch, beta, or manual).
 * @returns A `Promise` that resolves to the new version string.
 * @throws Error if the current version format is invalid.
 */
export async function getNewVersion(versionUpdateType: string): Promise<string> {
  const versionType = getVersionUpdateType(versionUpdateType);
  if (versionType === VersionUpdateType.Manual) {
    return versionUpdateType;
  }

  const npmPackage = await readNpmPackage();
  const currentVersion = npmPackage.version;

  const match = /^(\d+)\.(\d+)\.(\d+)(-beta.(\d+))?/.exec(currentVersion);
  if (!match) {
    throw new Error(`Invalid current version format: ${currentVersion}`);
  }

  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);
  let beta = match[5] ? Number(match[5]) : 0;

  switch (versionType) {
    case VersionUpdateType.Major:
      major++;
      minor = 0;
      patch = 0;
      beta = 0;
      break;
    case VersionUpdateType.Minor:
      minor++;
      patch = 0;
      beta = 0;
      break;
    case VersionUpdateType.Patch:
      patch++;
      beta = 0;
      break;
    case VersionUpdateType.Beta:
      if (beta === 0) {
        patch++;
      }
      beta++;
      break;
  }

  return `${major.toString()}.${minor.toString()}.${patch.toString()}${beta > 0 ? `-beta.${beta.toString()}` : ''}`;
}

/**
 * Fetches the latest version of Obsidian from the GitHub releases API.
 *
 * @returns A promise that resolves to the latest version of Obsidian.
 */
async function getLatestObsidianVersion(): Promise<string> {
  const response = await fetch('https://api.github.com/repos/obsidianmd/obsidian-releases/releases/latest');
  const obsidianReleasesJson = await response.json() as ObsidianReleasesJson;
  return obsidianReleasesJson.name;
}

/**
 * Updates the changelog file with new version information and commit messages.
 *
 * This function reads the current changelog, appends new entries for the latest version,
 * and prompts the user to review the changes.
 *
 * @param newVersion - The new version number to be added to the changelog.
 * @returns A promise that resolves when the changelog update is complete.
 */
export async function updateChangelog(newVersion: string): Promise<void> {
  const changelogPath = resolvePathFromRoot(ObsidianPluginRepoPaths.ChangelogMd);
  let previousChangelogLines: string[];
  if (!existsSync(changelogPath)) {
    previousChangelogLines = [];
  } else {
    const content = await readFile(changelogPath, 'utf-8');
    previousChangelogLines = content.split('\n').slice(2);
    if (previousChangelogLines.at(-1) === '') {
      previousChangelogLines.pop();
    }
  }

  const lastTag = previousChangelogLines[0]?.replace('## ', '');
  const commitRange = lastTag ? `${lastTag}..HEAD` : 'HEAD';
  const commitMessages = (await execFromRoot(`git log ${commitRange} --format=%s --first-parent`, { quiet: true })).split(/\r?\n/);

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

  await createInterface(process.stdin, process.stdout).question(`Please update the ${ObsidianPluginRepoPaths.ChangelogMd} file. Press Enter when you are done...`);
}

/**
 * Adds updated files to the Git staging area and commits them with the new version message.
 *
 * @param newVersion - The new version number used as the commit message.
 * @returns A promise that resolves when the files have been added and committed.
 */
export async function addUpdatedFilesToGit(newVersion: string): Promise<void> {
  const files = [
    ObsidianPluginRepoPaths.ManifestJson,
    ObsidianPluginRepoPaths.PackageJson,
    ObsidianPluginRepoPaths.PackageLockJson,
    ObsidianPluginRepoPaths.VersionsJson,
    ObsidianPluginRepoPaths.ChangelogMd
  ].filter((file) => existsSync(resolvePathFromRoot(file)));
  await execFromRoot(['git', 'add', ...files], { quiet: true });
  await execFromRoot(`git commit -m ${newVersion} --allow-empty`, { quiet: true });
}

/**
 * Creates a Git tag for the new version.
 *
 * @param newVersion - The new version number to use for the tag.
 * @returns A promise that resolves when the tag has been created.
 */
export async function addGitTag(newVersion: string): Promise<void> {
  await execFromRoot(`git tag -a ${newVersion} -m ${newVersion} --force`, { quiet: true });
}

/**
 * Pushes commits and tags to the remote Git repository.
 *
 * @returns A promise that resolves when the push operation is complete.
 */
export async function gitPush(): Promise<void> {
  await execFromRoot('git push --follow-tags --force', { quiet: true });
}

/**
 * Copies the updated manifest file to the distribution build directory.
 *
 * @returns A promise that resolves when the copy operation is complete.
 */
export async function copyUpdatedManifest(): Promise<void> {
  await cp(resolvePathFromRoot(ObsidianPluginRepoPaths.ManifestJson), resolvePathFromRoot(join(ObsidianPluginRepoPaths.DistBuild, ObsidianPluginRepoPaths.ManifestJson)), { force: true });
}

/**
 * Retrieves the release notes for a specific version from the changelog.
 *
 * @param newVersion - The new version number for which to get the release notes.
 * @returns A promise that resolves to the release notes for the specified version.
 */
export async function getReleaseNotes(newVersion: string): Promise<string> {
  const changelogPath = resolvePathFromRoot(ObsidianPluginRepoPaths.ChangelogMd);
  const content = await readFile(changelogPath, 'utf-8');
  const newVersionEscaped = newVersion.replaceAll('.', '\\.');
  const match = new RegExp(`\n## ${newVersionEscaped}\n\n((.|\n)+?)\n\n##`).exec(content);
  let releaseNotes = match?.[1] ? match[1] + '\n\n' : '';

  const tags = (await execFromRoot('git tag --sort=-creatordate', { quiet: true })).split(/\r?\n/);
  const previousVersion = tags[1];
  let changesUrl = '';

  const repoUrl = await execFromRoot('gh repo view --json url -q .url', { quiet: true });

  if (previousVersion) {
    changesUrl = `${repoUrl}/compare/${previousVersion}...${newVersion}`;
  } else {
    changesUrl = `${repoUrl}/commits/${newVersion}`;
  }

  releaseNotes += `**Full Changelog**: ${changesUrl}`;
  return releaseNotes;
}

/**
 * Publishes a GitHub release for the new version.
 *
 * Handles the creation of a release and uploading files for either an Obsidian plugin or another project.
 *
 * @param newVersion - The new version number for the release.
 * @param isObsidianPlugin - A boolean indicating if the project is an Obsidian plugin.
 * @returns A promise that resolves when the release has been published.
 */
export async function publishGitHubRelease(newVersion: string, isObsidianPlugin: boolean): Promise<void> {
  let filePaths: string[];

  if (isObsidianPlugin) {
    const buildDir = resolvePathFromRoot(ObsidianPluginRepoPaths.DistBuild);
    const fileNames = await readdirPosix(buildDir);
    filePaths = fileNames.map((fileName) => join(buildDir, fileName));
  } else {
    const zip = new AdmZip();
    zip.addLocalFolder(resolvePathFromRoot(ObsidianDevUtilsRepoPaths.Dist), ObsidianDevUtilsRepoPaths.Dist, (filename) => !filename.endsWith('.zip'));

    const files = [
      ObsidianDevUtilsRepoPaths.ChangelogMd,
      ObsidianDevUtilsRepoPaths.License,
      ObsidianDevUtilsRepoPaths.ReadmeMd,
      ObsidianDevUtilsRepoPaths.PackageJson
    ];

    for (const file of files) {
      zip.addLocalFile(resolvePathFromRoot(file));
    }

    const npmPackage = await readNpmPackage();
    const distZipPath = resolvePathFromRoot(join(ObsidianDevUtilsRepoPaths.Dist, `${npmPackage.name}-${newVersion}.zip`));
    zip.writeZip(distZipPath);
    filePaths = [distZipPath];
  }

  await execFromRoot(['gh', 'release', 'create', newVersion, ...filePaths, '--title', `v${newVersion}`, '--notes-file', '-'], {
    quiet: true,
    stdin: await getReleaseNotes(newVersion)
  });
}
