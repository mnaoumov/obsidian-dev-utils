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
  parse,
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
import {
  findForbiddenPatternMatches,
  FORBIDDEN_PATTERNS_FILE_ENV_VARIABLE,
  readForbiddenPatterns
} from './forbidden-patterns.ts';
import { readdirPosix } from './fs.ts';
import { gate } from './gate.ts';
import { editJson } from './json.ts';
import { spellcheckContent } from './linters/cspell-content.ts';
import { lintMarkdownContent } from './linters/markdownlint-content.ts';
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
  readonly prepareGitHubRelease?: (newVersion: string) => Promise<void>;

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

/**
 * The lowest bump a range of commits may be published under, and the commits that force it.
 */
interface BumpFloor {
  /**
   * The commits whose Conventional-Commits markers force {@link level}, in the order `git log` reported them.
   * Empty when nothing forces anything, which is the ordinary case for a range of `fix`es and `chore`s.
   */
  readonly forcingCommits: readonly ForcingCommit[];

  /**
   * The lowest {@link BumpLevel} the range may ship as.
   */
  readonly level: BumpLevel;
}

/**
 * What {@link toBumpFloorError} needs beyond the {@link BumpFloor} itself to say what was asked for and what
 * that would have shipped as.
 */
interface BumpFloorRefusalContext {
  /**
   * The previous release tag the range was measured from.
   */
  readonly lastTag: string;

  /**
   * The version the requested bump would have produced.
   */
  readonly newVersion: string;

  /**
   * The {@link BumpLevel} {@link newVersion} actually moves, relative to {@link lastTag}.
   */
  readonly takenLevel: BumpLevel;

  /**
   * The version update type the release was asked for, verbatim — which is a pre-release type or an explicit
   * version as often as it is a plain `patch`, and is therefore worth quoting back rather than inferring.
   */
  readonly versionUpdateType: string;
}

/**
 * The three release lines a bump can move, ordered by {@link isBumpLevelAtLeast}.
 *
 * A pre-release type is not one of these: `premajor` moves the major line and `prerelease` moves whichever
 * line an earlier pre-release already chose, so what a pre-release did is read off the resulting version
 * rather than off its type. See {@link toEffectiveBumpLevel}.
 */
type BumpLevel = VersionUpdateType.Major | VersionUpdateType.Minor | VersionUpdateType.Patch;

/**
 * One finding reported over the settled changelog section, tagged with the npm script whose check produced it.
 *
 * The tag is what lets one message name `lint:md`, `spellcheck` or both, truthfully. Both checks run over
 * every settle, so an author who has to fix a hard-wrapped line and a coined word fixes them in ONE round of
 * the review rather than being sent back twice.
 */
interface ChangelogFinding {
  /**
   * The npm script that would have reported this on the branch.
   */
  readonly scriptName: string;

  /**
   * The reported line, exactly as that script's own output would have carried it.
   */
  readonly text: string;
}

/**
 * One commit that forces a {@link BumpFloor}, rendered into the refusal so the author can go and look at it.
 */
interface ForcingCommit {
  /**
   * The {@link BumpLevel} this one commit forces on its own.
   */
  readonly level: BumpLevel;

  /**
   * What in the commit forced it — the `!` marker, the `BREAKING CHANGE:` footer, or the `feat` type — named
   * so a reader can tell a deliberate breaking marker from a footer somebody wrote in passing.
   */
  readonly marker: string;

  /**
   * The full commit hash.
   */
  readonly sha: string;

  /**
   * The commit subject.
   */
  readonly subject: string;
}

interface NpmPackResult {
  readonly filename: string;
}

/**
 * A `BREAKING CHANGE:` footer, in both spellings Conventional Commits allows.
 *
 * Matched per line (`m`) rather than against the whole message, because a footer sits at the bottom of the
 * body. It is the half of the breaking-change signal that {@link MERGE_SUBJECT_REG_EXP}'s sibling rewrite
 * cannot carry: `toChangelogEntry` lifts only the merge body's first line onto the merge subject, so a footer
 * written on a branch commit never reaches the first-parent history at all. That is why
 * {@link getBumpFloor} reads every commit in the range rather than only the first-parent ones.
 */
const BREAKING_CHANGE_FOOTER_REG_EXP = /^BREAKING[ -]CHANGE:/m;

/**
 * The marker names a {@link ForcingCommit} carries, and therefore what the refusal message says forced the
 * floor. They are spelled out rather than reduced to the level alone, because `feat!` and a `BREAKING CHANGE:`
 * footer buried in a body are very different things to be told about.
 */
const BREAKING_CHANGE_FOOTER_MARKER = 'a `BREAKING CHANGE:` footer';

/**
 * See {@link BREAKING_CHANGE_FOOTER_MARKER}.
 */
const BREAKING_MARKER = 'the `!` breaking marker';

/**
 * See {@link BREAKING_CHANGE_FOOTER_MARKER}.
 */
const FEAT_TYPE_MARKER = 'a `feat` type';

/**
 * A Conventional-Commits subject: a type, an optional scope, an optional `!`, then the colon.
 *
 * Deliberately tolerant of a subject that is not one at all — an unparsable subject simply constrains
 * nothing, which is the same answer a `chore:` gives. This gate exists to catch a bump that is too LOW, so
 * failing to recognize a subject can only under-constrain, never refuse a release that should have shipped.
 */
const CONVENTIONAL_COMMIT_SUBJECT_REG_EXP = /^(?<type>[a-z]+)(?:\([^()]*\))?(?<breaking>!)?:\s/i;

/**
 * The default pre-release identifier used for pre-release versions.
 */
const DEFAULT_PREID = 'beta';

/**
 * The Conventional-Commits type that forces a minor.
 */
const FEAT_TYPE = 'feat';

/**
 * The feed the Obsidian desktop app updates from.
 *
 * Deliberately NOT the GitHub `releases/latest` API: that endpoint returns the newest release of any kind
 * in `obsidianmd/obsidian-releases`, including one whose only asset is the Android APK, which no desktop
 * user can install. See {@link getLatestObsidianVersion}.
 */
const DESKTOP_RELEASES_JSON_URL = 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/desktop-releases.json';

/**
 * The npm scripts whose checks the settled changelog is held to, named in the messages so a reader knows which
 * gate they are looking at — and knows that fixing it here is the same fix as fixing it on the branch.
 */
const LINT_MD_SCRIPT_NAME = 'lint:md';

/**
 * How much of a commit hash the bump-floor refusal prints. Long enough to paste into `git show`, short enough
 * that a list of them stays readable.
 */
const SHORT_SHA_LENGTH = 8;

/**
 * See {@link LINT_MD_SCRIPT_NAME}.
 */
const SPELLCHECK_SCRIPT_NAME = 'spellcheck';

/**
 * The shape of a merge subject git wrote itself, rather than one an author chose.
 *
 * Every default git produces opens with `Merge` and a word boundary — `Merge branch 'x'`,
 * `Merge branches 'x' and 'y'`, `Merge remote-tracking branch 'x'`, `Merge pull request #1 from y`,
 * `Merge tag 'x'`, `Merge commit 'abc'` — which is what the optional alternation and the trailing `\b` cover
 * between them. Being that broad costs nothing here: every changelog entry in this workspace is a
 * Conventional-Commits subject, and those open with a type (`feat`, `fix`, `chore`, …), never with `Merge`.
 *
 * ONE pattern drives both halves of the guard, so they cannot drift apart: {@link toChangelogEntry} rewrites
 * a commit whose subject matches it, and {@link assertChangelogHasNoMergeSubjects} refuses a changelog line
 * that still does. The refusal is therefore reachable only for a merge the rewrite had nothing to work with.
 */
const MERGE_SUBJECT_REG_EXP = /^Merge(?: branch| remote-tracking| pull request)?\b/;

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

  const commitArguments = ['git', 'commit', '-m', `chore: release ${newVersion}`, '--allow-empty', ...(shouldVerifyCommit ? [] : ['--no-verify'])];

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
      return /^\d+\.\d+\.\d+(?:-[\w\d.-]+)?$/.test(versionUpdateType) ? VersionUpdateType.Manual : VersionUpdateType.Invalid;
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
    const resultOutput = await execFromRoot(['npm', 'pack', '--pack-destination', ObsidianDevUtilsRepoPaths.Dist, '--json'], { isQuiet: true });
    const result = parseNpmPackOutput(resultOutput);
    filePaths = [
      join(ObsidianDevUtilsRepoPaths.Dist, result.filename),
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
 * 4. Verifies that the bump is not lower than the commits since the last tag force it to be.
 * 5. Verifies that the Git repository is clean.
 * 6. Runs spellcheck and linting.
 * 7. Builds the project.
 * 8. Settles the changelog — the only step that can block on a human, and deliberately the last one before
 *    anything is written, so an interrupt here leaves the working tree clean and the release re-runnable.
 *    The settled text is linted here too: `lint:md` ran in step 6, before a character of it existed.
 * 9. Updates version in files, then writes the settled changelog.
 * 10. Adds updated files to Git, tags the commit, and pushes to the repository.
 * 11. If an Obsidian plugin, copies the updated manifest and publishes a GitHub release.
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
  // caller learns in seconds instead of paying for the whole preflight and only then blocking on an editor
  // window nobody will ever close.
  assertChangelogStepIsNonBlocking(changelogFilePath, shouldEditChangelog);
  // Same placement, same reason. Deliberately NOT under `shouldRunChecks`: that flag buys a fast release by
  // skipping the VERIFICATION of the code, and this is a correctness gate on the release itself — the bump
  // a `--no-checks` release ships is as public, and as unfixable afterwards, as any other.
  await assertVersionUpdateTypeMeetsBumpFloor(versionUpdateType);

  if (shouldRunChecks) {
    await assertGitRepoClean();
  }

  // The rest of the preflight IS `npm run gate`, not a copy of it: a check added to the gate is reachable
  // from the branch and from the release by construction, instead of by two lists happening to agree.
  // The clean-repo assertion above stays here, because the gate is run on a dirty tree on purpose.
  // The build is a prerequisite for publishing, not a verification check, so it runs unless `shouldBuild` is `false` — this keeps the released artifacts in sync with the current code even on a fast release.
  await gate({
    shouldBuild,
    shouldRunChecks,
    shouldRunIntegrationTests: true
  });

  const newVersion = await getNewVersion(versionUpdateType);

  // The changelog is settled BEFORE anything is written, because this is the only step that can block on a
  // human. Interrupting it therefore leaves the working tree pristine and the whole release re-runnable,
  // instead of stranding a bumped-but-uncommitted tree that `assertGitRepoClean` then refuses to re-release.
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
 * Refuses a changelog whose NEW section matches one of the maintainer's own unpublished forbidden patterns.
 *
 * Every commit subject since the last tag ships verbatim into the new section, so a subject that carries
 * vocabulary private to the maintainer — an internal tracker id, a private project short name — lands in a
 * checked-in, published file inside the release commit, where nothing ever looks at it again. The list of what
 * counts as private cannot live in this library or in the repository without publishing the very thing it
 * protects, so it comes from the file {@link FORBIDDEN_PATTERNS_FILE_ENV_VARIABLE} names, and this is a no-op
 * wherever that is not configured.
 *
 * Like {@link assertChangelogHasNoMergeSubjects}, only the section being published is scanned, and the throw
 * comes before anything is written.
 *
 * @param changelogContent - The full composed `CHANGELOG.md` content.
 * @param version - The version whose section is about to be published.
 * @returns A {@link Promise} that resolves when the section is clean.
 */
async function assertChangelogHasNoForbiddenPatterns(changelogContent: string, version: string): Promise<void> {
  const patterns = await readForbiddenPatterns();
  const matches = findForbiddenPatternMatches(extractChangelogSection(changelogContent, version), patterns);

  if (matches.length === 0) {
    return;
  }

  throw new Error(
    `The ${version} section of ${ObsidianPluginRepoPaths.ChangelogMd} matches a pattern from the file`
      + ` ${FORBIDDEN_PATTERNS_FILE_ENV_VARIABLE} names:\n`
      + `${matches.map(({ line, match }) => `${line}    <- ${match}`).join('\n')}\n`
      + 'Nothing has been written yet. Supply release notes that say the same thing without it, with'
      + ' `--changelog-file <path>`, or remove it at the interactive review, and re-run the release.'
  );
}

/**
 * Refuses a changelog whose NEW section still carries an entry that reads as a merge subject git wrote itself.
 *
 * The convention this enforces is that a non-ff merge takes the same Conventional-Commits subject as the branch
 * commit it lands. Nothing used to hold it: for a non-ff merge the first-parent commit is the merge commit, so a
 * default subject ships verbatim, publishing a bare branch name (`Merge branch 'fix-the-thing'`) as a changelog
 * entry — which says nothing about what changed, and on a branch named after a private tracker item decodes to
 * nothing at all for a reader. The interactive review was the de facto catch, and `--no-changelog-editing`, the
 * flag an unattended release actually uses, skips it; one sweep across this workspace found twelve such
 * published entries in a single repository.
 *
 * Only the section being published is scanned, so an entry already shipped under an older version cannot block
 * every future release. {@link toChangelogEntry} has already rewritten every merge that had a body to rewrite
 * from, so what reaches here is a merge whose author wrote nothing at all — which no rewrite can invent, and
 * which is therefore worth stopping the release for.
 *
 * @param changelogContent - The full composed `CHANGELOG.md` content.
 * @param version - The version whose section is about to be published.
 */
function assertChangelogHasNoMergeSubjects(changelogContent: string, version: string): void {
  const BULLET_REG_EXP = /^- /;
  const offendingEntries = extractChangelogSection(changelogContent, version)
    .split('\n')
    .filter((line) => MERGE_SUBJECT_REG_EXP.test(line.replace(BULLET_REG_EXP, '')));

  if (offendingEntries.length === 0) {
    return;
  }

  throw new Error(
    `The ${version} section of ${ObsidianPluginRepoPaths.ChangelogMd} carries a merge subject git wrote itself:\n`
      + `${offendingEntries.join('\n')}\n`
      + 'Such an entry publishes a branch name instead of saying what shipped. Give the merge commit the same'
      + ' subject as the branch commit it lands (`git commit --amend` on the merge, then re-run the release), or'
      + ' supply the release notes yourself with `--changelog-file <path>`.'
  );
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
 * Refuses a release whose bump is LOWER than the commits it is about to publish force it to be.
 *
 * The rule this enforces is old and was written down after `96.5.1` shipped six unreleased `feat:` commits as
 * a patch: choose the bump from the whole range since the last tag, never from the change you happen to be
 * working on. It did not hold — `105.1.0` of this library is a MINOR carrying `feat(vitest-config)!`, so every
 * consumer on a caret range took a breaking change with no version signal — and it could not hold, because it
 * asked a human to scan a range and then type a bump that nothing compared against what the scan would have
 * found. This is that comparison, at the one moment the rule is being broken.
 *
 * It refuses only a bump that is too LOW. A deliberately higher one — a major cut to signal a break late, a
 * minor for a range of pure `fix`es — passes untouched, and there is no flag to switch the gate off: an
 * opt-out is what gets reached for reflexively, and the legitimate escape (bump higher) already exists.
 *
 * Called from the preflight rather than at the bump itself, so a refusal costs seconds instead of the whole
 * check-and-build gate, and nothing has been written when it throws.
 *
 * @param versionUpdateType - The version update type the release was asked for.
 */
async function assertVersionUpdateTypeMeetsBumpFloor(versionUpdateType: string): Promise<void> {
  const versionDebugger = getLibDebugger('Version');
  const lastTag = await resolveLastReleasedTag(await readPreviousChangelogLines());

  // No baseline, no range, no floor. This is a first release, or one whose previous tag was deleted — the
  // changelog step falls back to the full history there, and deriving a floor from the full history of a repo
  // about to cut `1.0.0` would refuse it over commits that predate the concept of a published surface.
  if (!lastTag) {
    versionDebugger('No previous release tag resolved, so the bump floor is not derived. The bump is taken as given.');
    return;
  }

  const bumpFloor = await getBumpFloor(`${lastTag}..HEAD`);
  const floorLevel = bumpFloor.level;
  if (floorLevel === VersionUpdateType.Patch) {
    return;
  }

  const newVersion = await getNewVersion(versionUpdateType);
  const takenLevel = toEffectiveBumpLevel(lastTag, newVersion);

  // An unparsable baseline or target is not this gate's business to fail a release over. It can only happen
  // for a tag that is not a version at all, which every other step here would have its own trouble with.
  if (!takenLevel) {
    versionDebugger(`Could not compare '${newVersion}' against the previous tag '${lastTag}', so the bump floor is not enforced.`);
    return;
  }

  if (isBumpLevelAtLeast(takenLevel, floorLevel)) {
    return;
  }

  throw toBumpFloorError(bumpFloor, {
    lastTag,
    newVersion,
    takenLevel,
    versionUpdateType
  });
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
 * Derives the lowest bump a commit range may be published under, from the Conventional-Commits markers the
 * commits in it carry.
 *
 * A `!` before the subject's colon, or a `BREAKING CHANGE:` / `BREAKING-CHANGE:` footer, forces a major; a
 * `feat` type forces a minor; everything else — `fix`, `chore`, `docs`, `refactor`, an unparsable subject —
 * constrains nothing and yields a patch floor, which is no constraint at all.
 *
 * **Every commit in the range is read, deliberately NOT only the first-parent ones**, which is where this
 * differs from the changelog generated over the same range. The changelog is first-parent because it publishes
 * one line per landed change; a breaking change is breaking whichever parent it arrived on. Concretely,
 * {@link toChangelogEntry} lifts only the FIRST line of a merge body onto a default merge subject, so a
 * `BREAKING CHANGE:` footer written on a branch commit is invisible to the first-parent history — and a footer
 * is the one breaking signal Conventional Commits puts in the body rather than the subject. The cost of
 * reading everything is over-detection: a branch whose breaking commit was reworked into a non-breaking merge
 * still forces a major. That direction is safe — an over-bump costs a consumer nothing and the message names
 * the commit so the author can see exactly which one — and the other direction is the defect this exists for.
 *
 * @param commitRange - The git revision range to scan, e.g. `105.2.0..HEAD`.
 * @returns A {@link Promise} that resolves to the {@link BumpFloor} the range forces.
 */
async function getBumpFloor(commitRange: string): Promise<BumpFloor> {
  // `%H%n%B` puts the hash on its own first line and the full message under it, and `-z` separates the
  // commits with NUL — so nothing in a commit message can be mistaken for a record boundary.
  const output = await execFromRoot(['git', 'log', commitRange, '--format=%H%n%B', '-z'], { isQuiet: true });

  const forcingCommits = output
    .split('\0')
    .map((record) => toForcingCommit(record))
    .filter((forcingCommit) => forcingCommit !== null);

  return {
    forcingCommits,
    level: toHighestBumpLevel(forcingCommits)
  };
}

/**
 * Runs `lint:md`'s and `spellcheck`'s checks over the NEW section of a composed changelog, before any of it
 * reaches the repository.
 *
 * Only the new section is checked, and deliberately so. The honest check is the whole file, but it fails a
 * release on a defect in a section somebody shipped years ago — which is a release nobody can cut without
 * first fixing history, and is exactly how a changelog defect becomes a permanent blocker instead of a
 * two-minute fix. That is not hypothetical for the spelling half in particular: it is the state five
 * repositories in this workspace are in, each with a coined word already published in an old section. The new
 * section is the only part this release is responsible for.
 *
 * BOTH checks run over every settle, and neither short-circuits the other. An author who has a hard-wrapped
 * line and a coined word is told about both at once, in one round of the review, rather than fixing one and
 * being sent back for the other.
 *
 * Each half runs only where the project defines the script it stands for, just as {@link gate} runs that script
 * only where it is defined. A project with no `spellcheck` has no spelling configuration either, so `cspell` would
 * judge its release notes against the stock dictionaries alone and refuse the release over the plugin's own name:
 * a check the project never adopted, enforced only at release time.
 *
 * @param changelogContent - The full composed `CHANGELOG.md` content.
 * @param version - The version whose section is about to be published.
 * @returns A {@link Promise} that resolves to the findings, or an empty array when the section is clean.
 */
async function getChangelogSectionFindings(changelogContent: string, version: string): Promise<ChangelogFinding[]> {
  const content = toChangelogSectionDocument(changelogContent, version);
  const filePath = resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.ChangelogMd });
  const packageJson = await readPackageJson();
  const scriptNames = Object.keys(packageJson.scripts ?? {});

  const markdownlintFindings = scriptNames.includes(LINT_MD_SCRIPT_NAME)
    ? await lintMarkdownContent({
      content,
      filePath
    })
    : [];
  const spellingFindings = scriptNames.includes(SPELLCHECK_SCRIPT_NAME)
    ? await spellcheckContent({
      content,
      filePath
    })
    : [];

  return [
    ...markdownlintFindings.map((text) => ({
      scriptName: LINT_MD_SCRIPT_NAME,
      text
    })),
    ...spellingFindings.map((text) => ({
      scriptName: SPELLCHECK_SCRIPT_NAME,
      text
    }))
  ];
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
 * Whether a bump reaches a floor.
 *
 * Spelled out rather than given numeric ranks, because three levels do not need an ordering scheme and a
 * `2 >= 3` in a release gate is one transposition away from silently passing everything. `floorLevel` excludes
 * {@link VersionUpdateType.Patch} for the same reason it is not tested for: a patch floor is no floor, and its
 * only caller has already returned by then — a branch that can only ever answer `true` is one nobody reads and
 * nothing covers.
 *
 * @param level - The {@link BumpLevel} actually taken.
 * @param floorLevel - The {@link BumpLevel} required.
 * @returns Whether `level` is at least `floorLevel`.
 */
function isBumpLevelAtLeast(level: BumpLevel, floorLevel: VersionUpdateType.Major | VersionUpdateType.Minor): boolean {
  return floorLevel === VersionUpdateType.Major
    ? level === VersionUpdateType.Major
    : level !== VersionUpdateType.Patch;
}

function isPreRelease(version: string): boolean {
  return prerelease(version) !== null;
}

/**
 * Extracts the single pack result from the output of `npm pack --json`.
 *
 * Two things make this more than a `JSON.parse()`. The payload is PRECEDED on stdout by whatever the
 * `prepare` script printed (the `npm notice` lines go to stderr, not here), so its start has to be found —
 * and it is found by parsing from each candidate start rather than by matching a literal, because the
 * prefix may itself contain a brace. And the payload's SHAPE depends on the npm major: npm 11 and earlier
 * emit an array of pack results, npm 12 emits an object keyed by package name. Both are accepted; scanning
 * for the array's literal opening is what broke every release on npm 12.
 *
 * @param output - The stdout of `npm pack --json`.
 * @returns The {@link NpmPackResult} describing the packed tarball.
 * @throws If the output holds no parsable JSON payload, or the payload holds no pack result.
 */
function parseNpmPackOutput(output: string): NpmPackResult {
  for (const match of output.matchAll(/[[{]/g)) {
    let payload: unknown;

    try {
      payload = JSON.parse(output.slice(match.index));
    } catch {
      continue;
    }

    const results = Array.isArray(payload) ? payload as NpmPackResult[] : Object.values(payload as Record<string, NpmPackResult>);
    const result = results[0];

    if (!result) {
      throw new Error('Found no pack result in the `npm pack --json` output');
    }

    return result;
  }

  throw new Error('Failed to find the JSON payload in the `npm pack --json` output');
}

/**
 * Composes the full new `CHANGELOG.md` content — including the interactive review, when one is due —
 * WITHOUT touching the repository. Nothing here writes into the repo, so an interrupt anywhere in the
 * review window (the whole point of the split) leaves the working tree exactly as it was.
 *
 * The settled content is handed to {@link assertChangelogHasNoMergeSubjects} before it is returned, which is
 * how that guard reaches every caller and every path — reviewed or not, commit-derived or prepared — from a
 * single site.
 *
 * It is also where the new section is LINTED and SPELLCHECKED, for the same reason and one the release's
 * ordering forces: the release's only `lint:md` and `spellcheck` run in the gate, which is over before this
 * text exists, so every character of a new changelog section used to enter the repository after the only
 * checks that could have looked at it. The generator's own bullets cannot fail them — they are one
 * `toFirstLine` per commit — but the two paths a human or an agent writes, the interactive review and
 * `--changelog-file`, are exactly the paths that carry prose. A defect there does not fail the release: it
 * lands on the default branch inside the `chore: release` commit, and turns the NEXT gate red, on a branch
 * belonging to somebody who did not write it.
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
  const previousChangelogLines = await readPreviousChangelogLines();

  let newChangeLog = `# CHANGELOG\n\n## ${newVersion}\n\n`;

  if (changelogFilePath === undefined) {
    const lastTag = await resolveLastReleasedTag(previousChangelogLines);
    const commitRange = lastTag ? `${lastTag}..HEAD` : 'HEAD';
    const commitMessagesString = await execFromRoot(`git log ${commitRange} --format=%B --first-parent -z`, { isQuiet: true });
    const commitMessages = commitMessagesString.split('\0').filter(Boolean).map((commitMessage) => toChangelogEntry(commitMessage));

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
  const isReviewDue = changelogFilePath === undefined && shouldEditChangelog;
  let settledChangeLog = newChangeLog;
  let findings: ChangelogFinding[] = [];

  // The checks run on the SETTLED text, so the review sits inside the loop rather than before it: the author is
  // still sitting at the editor, so they are handed the findings and the same scratch copy back. A review that
  // returns byte-identical text is the author declining to fix them, which ends the loop instead of reopening
  // for ever. There is nobody to hand a finding to on the other paths, so those throw on the first one.
  for (;;) {
    if (isReviewDue) {
      const reviewedChangeLog = await reviewChangelog(settledChangeLog, findings);
      if (findings.length > 0 && reviewedChangeLog === settledChangeLog) {
        throw toChangelogFindingsError(findings, newVersion);
      }

      settledChangeLog = reviewedChangeLog;
    }

    findings = await getChangelogSectionFindings(settledChangeLog, newVersion);
    if (findings.length === 0) {
      break;
    }

    if (!isReviewDue) {
      throw toChangelogFindingsError(findings, newVersion);
    }
  }

  // The last thing the composition does, and that placement is the whole point: this ONE site sees the
  // commit-derived bullets, the prepared notes and whatever a review left behind, so the guard runs whether or not
  // the interactive review does — and the review is precisely what `--no-changelog-editing` skips. Nothing has been
  // written to the repository yet either, so the throw leaves the working tree pristine and the release re-runnable.
  assertChangelogHasNoMergeSubjects(settledChangeLog, newVersion);
  await assertChangelogHasNoForbiddenPatterns(settledChangeLog, newVersion);
  return settledChangeLog;
}

/**
 * Reads `CHANGELOG.md` and returns everything below its `# CHANGELOG` header — so the first line is the
 * newest `## <version>` heading, which is what names the last released version.
 *
 * @returns A {@link Promise} that resolves to the lines, or an empty array when the repository has no changelog
 * yet.
 */
async function readPreviousChangelogLines(): Promise<string[]> {
  const HEADER_LINES_COUNT = 2;
  const changelogPath = resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.ChangelogMd });
  if (!existsSync(changelogPath)) {
    return [];
  }

  const content = await readFile(changelogPath, 'utf-8');
  const previousChangelogLines = content.split('\n').slice(HEADER_LINES_COUNT);
  if (previousChangelogLines.at(-1) === '') {
    previousChangelogLines.pop();
  }

  return previousChangelogLines;
}

/**
 * Resolves the tag of the last released version — the baseline both the changelog range and the bump floor are
 * measured from, derived once here so those two can never disagree about which commits are being published.
 *
 * A heading is not a tag. A hand-written `## 0.0.0` placeholder in a never-tagged repo, or a tag deleted after
 * the fact, would otherwise reach `git log` as a revision it cannot resolve — and it used to reach it at the
 * very END of the release, after the whole preflight had been paid for. Falling back to no baseline
 * over-includes when a tag was deleted, but that is safe and visible: the changelog review is exactly where an
 * over-included range gets trimmed, and the bump floor declines to derive anything at all without a baseline.
 *
 * @param previousChangelogLines - The lines {@link readPreviousChangelogLines} returned.
 * @returns A {@link Promise} that resolves to the tag name, or an empty string when there is none to resolve.
 */
async function resolveLastReleasedTag(previousChangelogLines: string[]): Promise<string> {
  const lastTag = replaceAll({
    $string: previousChangelogLines[0] ?? '',
    replacer: '',
    searchValue: '## '
  });

  if (!lastTag) {
    return '';
  }

  const resolvedLastTag = await execFromRoot(['git', 'rev-parse', '--verify', '--quiet', `refs/tags/${lastTag}`], {
    isQuiet: true,
    shouldIgnoreExitCode: true
  });

  if (!resolvedLastTag) {
    getLibDebugger('Version')(
      `${ObsidianPluginRepoPaths.ChangelogMd} starts at '## ${lastTag}', but no such tag exists. Generating the changelog from the full history instead.`
    );
    return '';
  }

  return lastTag;
}

/**
 * Hands the composed changelog to the user for review on a scratch copy outside the repository, and
 * returns whatever they left behind. The scratch folder is removed even when the review fails.
 *
 * @param newChangeLog - The composed `CHANGELOG.md` content to hand over for review.
 * @param findings - The findings the previous round of this review left unfixed, printed above the prompt so
 * the author sees what has to change. Empty on the first round.
 * @returns A {@link Promise} that resolves to the reviewed content.
 */
async function reviewChangelog(newChangeLog: string, findings: ChangelogFinding[]): Promise<string> {
  const scratchFolder = await mkdtemp(join(tmpdir(), 'obsidian-dev-utils-changelog-'));
  const scratchChangelogPath = join(scratchFolder, ObsidianPluginRepoPaths.ChangelogMd);

  try {
    await writeFile(scratchChangelogPath, newChangeLog, 'utf-8');

    const codeVersion = await execFromRoot('code --version', {
      isQuiet: true,
      shouldIgnoreExitCode: true
    });
    const versionDebugger = getLibDebugger('Version');
    if (findings.length > 0) {
      versionDebugger(
        `${ObsidianPluginRepoPaths.ChangelogMd} does not pass ${toFailedScriptNames(findings)} yet:\n${toFindingLines(findings)}`
      );
    }

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

/**
 * Builds the error that refuses a bump lower than the range forces.
 *
 * It names every forcing commit with its short hash, its subject and WHICH marker forced it, because the
 * remedy depends on that: a `feat!` is a deliberate break somebody typed, while a `BREAKING CHANGE:` footer
 * sits in a body nobody re-reads and is exactly the thing this gate exists to surface. The instruction is to
 * take the higher bump, not to edit the commits — history that already reached the default branch is what a
 * release publishes, and rewriting it to dodge a version signal is the defect one level up.
 *
 * @param bumpFloor - The derived {@link BumpFloor}.
 * @param context - The {@link BumpFloorRefusalContext} describing what was asked for.
 * @returns The error to throw.
 */
function toBumpFloorError(bumpFloor: BumpFloor, context: BumpFloorRefusalContext): Error {
  const forcingLines = bumpFloor.forcingCommits
    .map((forcingCommit) => `  ${forcingCommit.sha.slice(0, SHORT_SHA_LENGTH)}  ${forcingCommit.subject}  (${forcingCommit.marker})`)
    .join('\n');

  return new Error(
    `The commits since ${context.lastTag} force at least a ${bumpFloor.level} release, but '${context.versionUpdateType}' would publish`
      + ` ${context.newVersion}, which is a ${context.takenLevel}.\n`
      + `${forcingLines}\n`
      + 'A release publishes every commit since the last tag, not the change you happen to be working on, so the'
      + ' bump has to answer for all of them. Re-run the release with a'
      + ` ${bumpFloor.level} bump — a higher one is always accepted, and nothing has been written yet.`
  );
}

/**
 * Turns one full commit message (`git log --format=%B`) into the changelog line it should contribute.
 *
 * Normally that is the subject. The exception is a merge whose subject git wrote itself: for a non-ff merge
 * the first-parent commit IS the merge commit, so its subject is what ships, and a default one publishes a
 * private branch name as a changelog entry. The message the author actually wrote is usually still there —
 * one line below, as the merge body — so it is lifted out rather than discarded, which is exactly the edit a
 * human makes by hand at the review step. A merge with no body has nothing to lift and keeps its subject;
 * {@link assertChangelogHasNoMergeSubjects} is what stops that one from being published.
 *
 * @param commitMessage - The full commit message.
 * @returns The changelog line for that commit.
 */
function toChangelogEntry(commitMessage: string): string {
  const lines = commitMessage.split(/\r?\n/).filter(Boolean);
  const subject = lines[0] ?? '';
  return MERGE_SUBJECT_REG_EXP.test(subject) ? lines[1] ?? subject : subject;
}

/**
 * Builds the error that stops a release whose new changelog section does not pass `lint:md` or `spellcheck`.
 *
 * It is thrown from the composition step, which is BEFORE anything is written, so the recovery it describes is
 * the whole recovery: there is nothing to revert, and the release re-runs from the top.
 *
 * @param findings - The findings, as {@link getChangelogSectionFindings} collected them.
 * @param version - The version whose section was being published.
 * @returns The error to throw.
 */
function toChangelogFindingsError(findings: ChangelogFinding[], version: string): Error {
  const scriptNames = toFailedScriptNames(findings);
  return new Error(
    `The ${version} section of ${ObsidianPluginRepoPaths.ChangelogMd} does not pass ${scriptNames}:\n`
      + `${toFindingLines(findings)}\n`
      + 'The changelog is settled before it is written, so this stops the release with the repository untouched'
      + ' and nothing to revert. The line numbers are the ones the written file would have had. Fix the release'
      + ' notes — in the prepared notes file, or in the commit messages they were generated from — or, for a word'
      + ' this project really does use, add it to the project\'s `cspell` configuration, and re-run the release.'
      + ' Releasing anyway would land the defect on the default branch inside the release commit, where the next'
      + ` ${scriptNames} on anyone's branch reports it.`
  );
}

/**
 * Wraps one version's changelog section in the minimal document the checks are handed.
 *
 * The section goes inside a document rather than on its own, so the heading and list rules see the
 * context they need (a document whose first line is a list item is a different document). The line numbers a
 * finding reports are then the composed `CHANGELOG.md`'s own, which is not a coincidence and is worth keeping:
 * a section is PREPENDED, so this document is character-for-character the head of the file about to be written.
 *
 * @param changelogContent - The full composed `CHANGELOG.md` content.
 * @param version - The version whose section is about to be published.
 * @returns The minimal document to check.
 */
function toChangelogSectionDocument(changelogContent: string, version: string): string {
  const heading = `# CHANGELOG\n\n## ${version}`;
  const section = extractChangelogSection(changelogContent, version);
  // An empty section is a real shape — a release with no commits to describe, or prepared notes that are an
  // empty file — and appending a blank body to the heading would report a defect this release did not commit.
  return section === '' ? `${heading}\n` : `${heading}\n\n${section}\n`;
}

/**
 * Reads off which release line a version actually moves, relative to the baseline it is being cut from.
 *
 * This is measured rather than read off the requested type on purpose, because the type does not always say.
 * `prerelease` advances whichever line an earlier `premajor` or `preminor` already chose, and an explicit
 * `x.y.z` says nothing at all until it is compared. Taking the coordinates of the resulting version answers all
 * of them with one rule — and it answers them the way a consumer's caret range sees it, which is the only
 * reading that matters for a published surface.
 *
 * @param baseVersion - The previous released version.
 * @param newVersion - The version about to be published.
 * @returns The {@link BumpLevel}, or `null` when either version is not parsable as semver.
 */
function toEffectiveBumpLevel(baseVersion: string, newVersion: string): BumpLevel | null {
  const base = parse(baseVersion);
  const next = parse(newVersion);
  if (!base || !next) {
    return null;
  }

  if (next.major > base.major) {
    return VersionUpdateType.Major;
  }

  return next.minor > base.minor ? VersionUpdateType.Minor : VersionUpdateType.Patch;
}

/**
 * Names the npm scripts that actually reported something, in the order they ran.
 *
 * Naming both unconditionally would be the easy version and would be a lie half the time: a release stopped by
 * a coined word would tell its author to go and look at `lint:md`, which passed.
 *
 * @param findings - The findings to name the scripts of.
 * @returns The script names, joined for prose — `lint:md`, `spellcheck`, or `lint:md and spellcheck`.
 */
function toFailedScriptNames(findings: ChangelogFinding[]): string {
  const scriptNames = [LINT_MD_SCRIPT_NAME, SPELLCHECK_SCRIPT_NAME].filter((scriptName) => findings.some((finding) => finding.scriptName === scriptName));
  return scriptNames.join(' and ');
}

/**
 * Renders the findings for a message, each line tagged with the script that reported it.
 *
 * The tag is not decoration: the two tools' output shapes are similar enough to be mistaken for each other,
 * and the fix for one is not the fix for the other.
 *
 * @param findings - The findings to render.
 * @returns The rendered lines, one finding per line.
 */
function toFindingLines(findings: ChangelogFinding[]): string {
  return findings.map((finding) => `[${finding.scriptName}] ${finding.text}`).join('\n');
}

/**
 * Classifies one `git log --format=%H%n%B -z` record into the {@link ForcingCommit} it is, or `null` when it
 * forces nothing.
 *
 * @param record - One NUL-delimited record: the full hash on the first line, the full commit message below it.
 * @returns The {@link ForcingCommit}, or `null` for a record that constrains nothing or is not a record at all
 * (the trailing empty string `-z` output ends with, among others).
 */
function toForcingCommit(record: string): ForcingCommit | null {
  // The trailing empty record `-z` leaves has no hash, and a record with no line under the hash is not one
  // this can classify. Both are the same non-answer.
  const [sha, subjectLine, ...bodyLines] = record.split('\n');
  if (!sha || subjectLine === undefined) {
    return null;
  }

  const subject = subjectLine.trim();
  const body = bodyLines.join('\n');
  const subjectMatch = CONVENTIONAL_COMMIT_SUBJECT_REG_EXP.exec(subject);

  if (subjectMatch?.groups?.['breaking']) {
    return {
      level: VersionUpdateType.Major,
      marker: BREAKING_MARKER,
      sha,
      subject
    };
  }

  if (BREAKING_CHANGE_FOOTER_REG_EXP.test(body)) {
    return {
      level: VersionUpdateType.Major,
      marker: BREAKING_CHANGE_FOOTER_MARKER,
      sha,
      subject
    };
  }

  return subjectMatch?.groups?.['type']?.toLowerCase() === FEAT_TYPE
    ? {
      level: VersionUpdateType.Minor,
      marker: FEAT_TYPE_MARKER,
      sha,
      subject
    }
    : null;
}

/**
 * Reduces the commits that force something to the one floor the range as a whole has to clear.
 *
 * @param forcingCommits - The {@link ForcingCommit}s found in the range.
 * @returns The highest {@link BumpLevel} any of them forces, or {@link VersionUpdateType.Patch} — no
 * constraint — when there are none.
 */
function toHighestBumpLevel(forcingCommits: readonly ForcingCommit[]): BumpLevel {
  if (forcingCommits.some((forcingCommit) => forcingCommit.level === VersionUpdateType.Major)) {
    return VersionUpdateType.Major;
  }

  return forcingCommits.length > 0 ? VersionUpdateType.Minor : VersionUpdateType.Patch;
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
