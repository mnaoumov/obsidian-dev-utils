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

import { existsSync } from 'node:fs';
import process from 'node:process';

import {
  dirname,
  join,
  toPosixPath
} from '../path.ts';
import { getMandatoryNamedGroup } from '../reg-exp.ts';
import { assertNever } from '../type-guards.ts';
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
 * The lockfile is the primary signal, because it describes the tree itself rather than whichever manager
 * happens to have launched the current process. When no lockfile is present, the manager that launched us
 * is the next best answer, and every manager reports itself in `npm_config_user_agent` as a leading
 * `<name>/<version>` token.
 *
 * @param cwd - The current working folder to resolve from.
 * @returns The detected package manager, or {@link PackageManager.Npm} when nothing indicates otherwise.
 */
export function getPackageManager(cwd?: string): PackageManager {
  const root = getStartFolder(cwd);

  if (
    existsSync(join(root, ObsidianDevUtilsRepoPaths.BunLock))
    || existsSync(join(root, ObsidianDevUtilsRepoPaths.BunLockb))
  ) {
    return PackageManager.Bun;
  }

  if (existsSync(join(root, ObsidianDevUtilsRepoPaths.PnpmLockYaml))) {
    return PackageManager.Pnpm;
  }

  if (existsSync(join(root, ObsidianDevUtilsRepoPaths.YarnLock))) {
    return PackageManager.Yarn;
  }

  if (existsSync(join(root, ObsidianDevUtilsRepoPaths.PackageLockJson))) {
    return PackageManager.Npm;
  }

  return detectPackageManagerFromUserAgent() ?? PackageManager.Npm;
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
 * Matches the leading `<name>/` token of an `npm_config_user_agent` value.
 */
const USER_AGENT_NAME_REG_EXP = /^(?<name>[^/\s]+)\//;

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

  const name = getMandatoryNamedGroup(match, 'name');

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
