/**
 * @file
 *
 * Resolves locally-installed tool binaries and package-script runners without assuming `npm`.
 *
 * Delegating to `npx` silently assumes an npm-installed tree. On Windows that assumption is fatal under
 * `bun`: `bun install` writes `node_modules/.bin/<tool>.exe`, not the `<tool>.cmd` that npm's `npx` looks
 * for, so `npx` misses the local install entirely and downloads the tool from the registry instead — which
 * for `tsc` is the well-known decoy package, not TypeScript. Resolving the shim from `node_modules/.bin`
 * ourselves sidesteps the whole shim-format question, because every package manager writes one there.
 */

import type { PackageJson } from 'type-fest';

import { existsSync } from 'node:fs';
import process from 'node:process';

import {
  dirname,
  join,
  toPosixPath
} from '../path.ts';
import { getMandatoryNamedGroup } from '../reg-exp.ts';
import { assertNever } from '../type-guards.ts';
import { readJsonSync } from './json.ts';
import { ObsidianDevUtilsRepoPaths } from './obsidian-dev-utils-repo-paths.ts';
import { getRootFolder } from './root.ts';

/**
 * A package manager that can own a project's dependency tree.
 */
export enum PackageManager {
  /**
   * The `bun` package manager.
   */
  Bun = 'bun',

  /**
   * The `npm` package manager.
   */
  Npm = 'npm',

  /**
   * The `pnpm` package manager.
   */
  Pnpm = 'pnpm',

  /**
   * The `yarn` package manager.
   */
  Yarn = 'yarn'
}

/**
 * Parameters for {@link resolveToolCommand}.
 */
export interface ResolveToolCommandParams {
  /**
   * The current working folder to resolve from.
   */
  readonly cwd?: string;

  /**
   * The name of the locally-installed tool, as it appears in `node_modules/.bin`.
   */
  readonly tool: string;
}

/**
 * Determines which package manager owns the project's dependency tree.
 *
 * Every signal is collected before any of them is believed, because a repo carrying two lockfiles used to
 * resolve to whichever sat earlier in a fixed list — silently reassigning every package script and every
 * tool invocation to a manager that never installed the tree.
 *
 * The order is:
 *
 * 1. The `packageManager` field of `package.json`. It is a deliberate declaration by the repo's author
 *    rather than an artifact left behind by whatever ran last, so it outranks every lockfile — and it is
 *    the only signal that helps at all before the first install, when no lockfile exists yet.
 * 2. The sole lockfile, when exactly one manager claims the tree.
 * 3. Among several lockfiles, the manager that launched us (`npm_config_user_agent`), when it owns one of
 *    them — a live signal beats a file that may have been abandoned mid-migration. Otherwise the
 *    documented fallback order in {@link LOCKFILES} decides. Note this is deliberately NOT "the most
 *    recently modified lockfile": a stray lockfile is typically the newest file, so mtime picks precisely
 *    the wrong one.
 * 4. `npm_config_user_agent` on its own, when there is no lockfile.
 * 5. {@link PackageManager.Npm}.
 *
 * Whenever more than one manager claims the tree, the disagreement is reported once per project through
 * {@link warnAboutSeveralClaimants} — the resolution stays deterministic, but it stops being silent.
 *
 * @param cwd - The current working folder to resolve from.
 * @returns The detected package manager, or {@link PackageManager.Npm} when nothing indicates otherwise.
 */
export function getPackageManager(cwd?: string): PackageManager {
  const root = getStartFolder(cwd);
  const declaredPackageManager = detectPackageManagerFromPackageJson(root);
  const lockfiles = LOCKFILES.filter((lockfile) => existsSync(join(root, lockfile.fileName)));
  const claimants = new Set(lockfiles.map((lockfile) => lockfile.packageManager));

  if (declaredPackageManager !== null) {
    claimants.add(declaredPackageManager);
  }

  const packageManager = resolvePackageManager({
    claimants,
    declaredPackageManager
  });

  if (claimants.size > 1) {
    warnAboutSeveralClaimants({
      declaredPackageManager,
      lockfiles,
      packageManager,
      root
    });
  }

  return packageManager;
}

/**
 * Builds the command parts that run a package script through the manager that owns the tree.
 *
 * @param cwd - The current working folder to resolve from.
 * @returns The command parts, e.g. `['bun', 'run']`. The script name is appended by the caller.
 */
export function getPackageManagerRunCommand(cwd?: string): string[] {
  return [getPackageManager(cwd), 'run'];
}

/**
 * Builds the command parts that run a locally-installed tool, with the tool itself already included.
 *
 * Prefers the shim in the nearest `node_modules/.bin`, walking up through ancestor folders so a hoisted
 * workspace install is still found. Falls back to the owning manager's exec form when no shim resolves —
 * which is both the previous behavior and the only thing that works under yarn's Plug'n'Play, where
 * `node_modules/.bin` does not exist at all.
 *
 * @param params - The parameters for the resolution.
 * @returns The command parts, e.g. `['/project/node_modules/.bin/tsc']` or `['bun', 'x', 'tsc']`.
 */
export function resolveToolCommand(params: ResolveToolCommandParams): string[] {
  const { cwd, tool } = params;
  const shimPath = findBinShim({ cwd, tool });

  if (shimPath !== null) {
    return [shimPath];
  }

  return [...getPackageManagerExecCommand(cwd), tool];
}

/**
 * Matches the leading `<name>@` token of a `package.json` `packageManager` value.
 *
 * The `@` is required, because corepack's format is `<name>@<version>` — a bare name is a malformed
 * declaration rather than a shorthand, and is ignored instead of guessed at.
 */
const DECLARATION_NAME_REG_EXP = /^(?<name>[^@\s]+)@/;

/**
 * The lockfiles that identify a package manager, in the order they decide a tie no other signal settles.
 *
 * Both bun lockfile formats map to the same manager, so a repo holding both is one claimant, not two.
 */
const LOCKFILES: LockfileClaim[] = [
  { fileName: ObsidianDevUtilsRepoPaths.BunLock, packageManager: PackageManager.Bun },
  { fileName: ObsidianDevUtilsRepoPaths.BunLockb, packageManager: PackageManager.Bun },
  { fileName: ObsidianDevUtilsRepoPaths.PnpmLockYaml, packageManager: PackageManager.Pnpm },
  { fileName: ObsidianDevUtilsRepoPaths.YarnLock, packageManager: PackageManager.Yarn },
  { fileName: ObsidianDevUtilsRepoPaths.PackageLockJson, packageManager: PackageManager.Npm }
];

/**
 * Matches the leading `<name>/` token of an `npm_config_user_agent` value.
 */
const USER_AGENT_NAME_REG_EXP = /^(?<name>[^/\s]+)\//;

/**
 * The disagreements already reported, so a build that resolves the manager once per script hop and once
 * per tool invocation still says it only once.
 */
const reportedDisagreements = new Set<string>();

/**
 * Parameters for {@link findBinShim}.
 */
interface FindBinShimParams {
  /**
   * The current working folder to resolve from.
   */
  readonly cwd?: string | undefined;

  /**
   * The name of the locally-installed tool.
   */
  readonly tool: string;
}

/**
 * A lockfile and the package manager whose presence it proves.
 */
interface LockfileClaim {
  /**
   * The lockfile name, as it appears at the project root.
   */
  readonly fileName: string;

  /**
   * The package manager that writes this lockfile.
   */
  readonly packageManager: PackageManager;
}

/**
 * Parameters for {@link resolvePackageManager}.
 */
interface ResolvePackageManagerParams {
  /**
   * Every package manager claiming the tree — the lockfile owners in {@link LOCKFILES} order, plus the
   * declared one. Only consulted when nothing is declared, in which case it holds exactly the lockfile
   * owners.
   */
  readonly claimants: ReadonlySet<PackageManager>;

  /**
   * The package manager declared in `package.json`, or `null` when none is.
   */
  readonly declaredPackageManager: null | PackageManager;
}

/**
 * Parameters for {@link warnAboutSeveralClaimants}.
 */
interface WarnAboutSeveralClaimantsParams {
  /**
   * The package manager declared in `package.json`, or `null` when none is.
   */
  readonly declaredPackageManager: null | PackageManager;

  /**
   * The lockfiles actually found at the project root.
   */
  readonly lockfiles: readonly LockfileClaim[];

  /**
   * The package manager that won.
   */
  readonly packageManager: PackageManager;

  /**
   * The project root the lockfiles were found in.
   */
  readonly root: string;
}

/**
 * Reads the package manager out of the `packageManager` field of the project's `package.json`, which is
 * corepack's `<name>@<version>` declaration.
 *
 * @param root - The project root to read `package.json` from.
 * @returns The declared package manager, or `null` when there is no `package.json`, it cannot be parsed,
 * the field is absent or malformed, or it names a manager we do not handle.
 */
function detectPackageManagerFromPackageJson(root: string): null | PackageManager {
  const packageJsonPath = join(root, ObsidianDevUtilsRepoPaths.PackageJson);

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  let packageJson: PackageJson;

  try {
    packageJson = readJsonSync<PackageJson>(packageJsonPath);
  } catch {
    return null;
  }

  const declaration = packageJson.packageManager;

  if (!declaration) {
    return null;
  }

  const match = DECLARATION_NAME_REG_EXP.exec(declaration);

  if (!match) {
    return null;
  }

  return parsePackageManagerName(getMandatoryNamedGroup(match, 'name'));
}

/**
 * Reads the package manager out of `npm_config_user_agent`, which every manager sets for the processes it
 * launches.
 *
 * @returns The detected package manager, or `null` when the variable is absent, malformed, or names a
 * runtime we do not handle.
 */
function detectPackageManagerFromUserAgent(): null | PackageManager {
  const userAgent = process.env['npm_config_user_agent'];

  if (!userAgent) {
    return null;
  }

  const match = USER_AGENT_NAME_REG_EXP.exec(userAgent);

  if (!match) {
    return null;
  }

  return parsePackageManagerName(getMandatoryNamedGroup(match, 'name'));
}

/**
 * Finds the `node_modules/.bin` shim for a tool, walking up from the project root through ancestor folders.
 *
 * @param params - The parameters for the lookup.
 * @returns The absolute path of the shim, or `null` when none exists.
 */
function findBinShim(params: FindBinShimParams): null | string {
  const { cwd, tool } = params;
  const candidates = getShimCandidates(tool);
  let currentFolder = getStartFolder(cwd);

  while (
    currentFolder !== ObsidianDevUtilsRepoPaths.CurrentFolder as string
    && currentFolder !== ObsidianDevUtilsRepoPaths.RootFolder as string
  ) {
    for (const candidate of candidates) {
      const shimPath = join(currentFolder, ObsidianDevUtilsRepoPaths.NodeModules, ObsidianDevUtilsRepoPaths.Bin, candidate);
      if (existsSync(shimPath)) {
        return shimPath;
      }
    }

    currentFolder = dirname(currentFolder);
  }

  return null;
}

/**
 * Builds the command parts that run a one-off tool through the manager that owns the tree.
 *
 * @param cwd - The current working folder to resolve from.
 * @returns The command parts, e.g. `['bun', 'x']`. The tool name is appended by the caller.
 */
function getPackageManagerExecCommand(cwd?: string): string[] {
  const packageManager = getPackageManager(cwd);

  switch (packageManager) {
    case PackageManager.Bun: {
      return ['bun', 'x'];
    }
    case PackageManager.Npm: {
      return ['npx'];
    }
    case PackageManager.Pnpm: {
      return ['pnpm', 'exec'];
    }
    case PackageManager.Yarn: {
      return ['yarn', 'exec'];
    }
    /* v8 ignore start -- Exhaustive switch guard; default branch is unreachable. */
    default: {
      return assertNever(packageManager);
    }
      /* v8 ignore stop */
  }
}

/**
 * Lists the shim file names to try for a tool, most specific first.
 *
 * On Windows only the executable forms are viable: npm and pnpm also write a shim with no extension, but
 * that one is a `sh` script that `cmd.exe` cannot run, so it must never be chosen there.
 *
 * @param tool - The name of the locally-installed tool.
 * @returns The candidate file names, in the order they should be tried.
 */
function getShimCandidates(tool: string): string[] {
  if (process.platform !== 'win32') {
    return [tool];
  }

  return [
    `${tool}${ObsidianDevUtilsRepoPaths.CommandExtension}`,
    `${tool}${ObsidianDevUtilsRepoPaths.ExeExtension}`,
    `${tool}${ObsidianDevUtilsRepoPaths.BatExtension}`
  ];
}

/**
 * Resolves the folder to start a lookup from — the project root when there is one, the working folder
 * otherwise.
 *
 * @param cwd - The current working folder to resolve from.
 * @returns The absolute folder to start from.
 */
function getStartFolder(cwd?: string): string {
  return getRootFolder(cwd) ?? toPosixPath(cwd ?? process.cwd());
}

/**
 * Maps the bare name a lockfile declaration or a user agent reports onto the package manager it names.
 *
 * @param name - The reported name.
 * @returns The matching package manager, or `null` for a runtime we do not handle.
 */
function parsePackageManagerName(name: string): null | PackageManager {
  switch (name) {
    case PackageManager.Bun as string: {
      return PackageManager.Bun;
    }
    case PackageManager.Npm as string: {
      return PackageManager.Npm;
    }
    case PackageManager.Pnpm as string: {
      return PackageManager.Pnpm;
    }
    case PackageManager.Yarn as string: {
      return PackageManager.Yarn;
    }
    default: {
      return null;
    }
  }
}

/**
 * Picks the winner out of the collected signals, per the order documented on {@link getPackageManager}.
 *
 * @param params - The parameters for the resolution.
 * @returns The package manager that owns the tree.
 */
function resolvePackageManager(params: ResolvePackageManagerParams): PackageManager {
  const {
    claimants,
    declaredPackageManager
  } = params;

  if (declaredPackageManager !== null) {
    return declaredPackageManager;
  }

  const lockfileOwners = [...claimants];
  const [firstLockfileOwner] = lockfileOwners;

  if (firstLockfileOwner === undefined) {
    return detectPackageManagerFromUserAgent() ?? PackageManager.Npm;
  }

  if (lockfileOwners.length === 1) {
    return firstLockfileOwner;
  }

  const launchedBy = detectPackageManagerFromUserAgent();

  if (launchedBy !== null && claimants.has(launchedBy)) {
    return launchedBy;
  }

  return firstLockfileOwner;
}

/**
 * Reports that several package managers claim the same tree, naming each lockfile found, what
 * `package.json` declares, and which manager won.
 *
 * `console.warn` rather than a debug channel: this runs in the build's own terminal, and a message nobody
 * sees unless they already suspect the problem leaves the failure exactly as silent as it was. Each
 * distinct message is printed once, because the manager is resolved once per package-script hop and once
 * per tool invocation.
 *
 * @param params - The parameters for the report.
 */
function warnAboutSeveralClaimants(params: WarnAboutSeveralClaimantsParams): void {
  const {
    declaredPackageManager,
    lockfiles,
    packageManager,
    root
  } = params;

  const lockfileNames = lockfiles.map((lockfile) => lockfile.fileName).join(', ');
  const advice = declaredPackageManager === null
    ? 'Delete the stale lockfile, or declare "packageManager" in package.json, to settle it.'
    : 'Delete the stale lockfile to settle it.';
  const message = [
    `obsidian-dev-utils: more than one package manager claims ${root}.`,
    `Lockfiles: ${lockfileNames}.`,
    `package.json "packageManager": ${declaredPackageManager ?? 'not set'}.`,
    `Using ${packageManager}.`,
    advice
  ].join(' ');

  if (reportedDisagreements.has(message)) {
    return;
  }

  reportedDisagreements.add(message);
  console.warn(message);
}
