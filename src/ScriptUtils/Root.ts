/**
 * @packageDocumentation
 *
 * Contains utility functions for executing commands from the root folder of a project,
 * resolving paths relative to the root.
 */

import type {
  ExecOption,
  ExecResult
} from './Exec.ts';

import {
  dirname,
  join,
  relative,
  resolve,
  toPosixPath
} from '../Path.ts';
import { exec } from './Exec.ts';
import { existsSync } from './NodeModules.ts';
import { ObsidianDevUtilsRepoPaths } from './ObsidianDevUtilsRepoPaths.ts';

/**
 * Executes a command from the root folder of the project.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @returns A {@link Promise} that resolves with the output of the command.
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is false.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is true,
 *         the error is resolved with the stdout and stderr.
 */
export async function execFromRoot(command: string | string[], options?: { withDetails?: false } & ExecOption): Promise<string>;
/**
 * Executes a command from the root folder of the project.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @returns A {@link Promise} that resolves with ExecResult object.
 *          The ExecResult object contains the exit code, exit signal, stderr, and stdout.
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is false.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is true,
 *         the error is resolved with the stdout and stderr.
 */
export function execFromRoot(command: string | string[], options: { withDetails: true } & ExecOption): Promise<ExecResult>;
/**
 * Executes a command from the root folder of the project.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @returns A {@link Promise} that resolves with the output of the command or an ExecResult object.
 *          The ExecResult object contains the exit code, exit signal, stderr, and stdout.
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is false.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is true,
 *         the error is resolved with the stdout and stderr.
 */
export function execFromRoot(command: string | string[], options: ExecOption = {}): Promise<ExecResult | string> {
  let root = getRootFolder(options.cwd);

  if (!root) {
    if (options.shouldFailIfCalledFromOutsideRoot ?? true) {
      throw new Error('Could not find root folder');
    }

    root = options.cwd ?? process.cwd();
  }

  if (options.shouldIncludeDetails) {
    return exec(command, { ...options, cwd: root, shouldIncludeDetails: true });
  }

  return exec(command, { ...options, cwd: root, shouldIncludeDetails: false });
}

/**
 * Retrieves the root folder of the project.
 *
 * @param cwd - The current working folder to resolve from.
 * @returns The path to the root folder.
 * @throws If the root folder cannot be found.
 */
export function getRootFolder(cwd?: string): null | string {
  let currentFolder = toPosixPath(cwd ?? process.cwd());
  while (currentFolder !== ObsidianDevUtilsRepoPaths.CurrentFolder as string && currentFolder !== ObsidianDevUtilsRepoPaths.RootFolder as string) {
    if (existsSync(join(currentFolder, ObsidianDevUtilsRepoPaths.PackageJson))) {
      return toPosixPath(currentFolder);
    }
    currentFolder = dirname(currentFolder);
  }

  return null;
}

/**
 * Resolves a path relative to the root folder of the project.
 *
 * @param path - The path to resolve.
 * @param cwd - The current working folder to resolve from.
 * @returns The resolved absolute path.
 */
export function resolvePathFromRoot(path: string, cwd?: string): null | string {
  const rootFolder = getRootFolder(cwd);
  if (!rootFolder) {
    return null;
  }

  return resolve(rootFolder, path);
}

/**
 * Resolves a path relative to the root folder, returning the resolved path or the original path if it does not exist.
 *
 * @param path - The path to resolve.
 * @param cwd - The current working folder to resolve from.
 * @returns The resolved path or the original path if it does not exist.
 */
export function resolvePathFromRootSafe(path: string, cwd?: string): string {
  return resolvePathFromRoot(path, cwd) ?? path;
}

/**
 * Converts an absolute path to a relative path from the root folder of the project.
 *
 * @param path - The absolute path to convert.
 * @param cwd - The current working folder to resolve from.
 * @returns The relative path from the root folder.
 */
export function toRelativeFromRoot(path: string, cwd?: string): null | string {
  const rootFolder = getRootFolder(cwd);
  if (!rootFolder) {
    return null;
  }

  path = toPosixPath(path);
  return relative(rootFolder, path);
}
