/**
 * @packageDocumentation Root
 * Contains utility functions for executing commands from the root directory of a project,
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
 * Executes a command from the root directory of the project.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @returns A Promise that resolves with the output of the command.
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is false.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is true,
 *         the error is resolved with the stdout and stderr.
 */
export async function execFromRoot(command: string | string[], options?: { withDetails?: false } & ExecOption): Promise<string>;

/**
 * Executes a command from the root directory of the project.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @returns A Promise that resolves with ExecResult object.
 *          The ExecResult object contains the exit code, exit signal, stderr, and stdout.
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is false.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is true,
 *         the error is resolved with the stdout and stderr.
 */
export function execFromRoot(command: string | string[], options: { withDetails: true } & ExecOption): Promise<ExecResult>;

/**
 * Executes a command from the root directory of the project.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @returns A Promise that resolves with the output of the command or an ExecResult object.
 *          The ExecResult object contains the exit code, exit signal, stderr, and stdout.
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is false.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is true,
 *         the error is resolved with the stdout and stderr.
 */
export function execFromRoot(command: string | string[], options: ExecOption = {}): Promise<ExecResult | string> {
  const root = getRootDir(options.cwd);
  if (options.shouldIncludeDetails) {
    return exec(command, { ...options, cwd: root, shouldIncludeDetails: true });
  }

  return exec(command, { ...options, cwd: root, shouldIncludeDetails: false });
}

/**
 * Retrieves the root directory of the project.
 *
 * @param cwd - The current working directory to resolve from.
 * @returns The path to the root directory.
 * @throws If the root directory cannot be found.
 */
export function getRootDir(cwd?: string): string {
  let currentDir = toPosixPath(cwd ?? process.cwd());
  while (currentDir !== '.' && currentDir !== '/') {
    if (existsSync(join(currentDir, ObsidianDevUtilsRepoPaths.PackageJson))) {
      return toPosixPath(currentDir);
    }
    currentDir = dirname(currentDir);
  }

  throw new Error('Could not find root directory');
}

/**
 * Resolves a path relative to the root directory of the project.
 *
 * @param path - The path to resolve.
 * @param cwd - The current working directory to resolve from.
 * @returns The resolved absolute path.
 */
export function resolvePathFromRoot(path: string, cwd?: string): string {
  return resolve(getRootDir(cwd), path);
}

/**
 * Converts an absolute path to a relative path from the root directory of the project.
 *
 * @param path - The absolute path to convert.
 * @param cwd - The current working directory to resolve from.
 * @returns The relative path from the root directory.
 */
export function toRelativeFromRoot(path: string, cwd?: string): string {
  const rootDir = getRootDir(cwd);
  path = toPosixPath(path);
  return relative(rootDir, path);
}
