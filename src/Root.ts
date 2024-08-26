/**
 * @packageDocumentation Root
 * Contains utility functions for executing commands from the root directory of a project,
 * resolving paths relative to the root.
 */

import { spawn } from "node:child_process";
import {
  relative,
  resolve
} from "./Path.ts";
import process from "node:process";
import { packageDirectorySync } from "pkg-dir";
import { toPosixPath } from "./Path.ts";
import { trimEnd } from "./String.ts";
import { toCommandLine } from "./cli.ts";

/**
 * Represents the result of executing a command from the root directory.
 */
export type ExecFromRootResult = {
  /**
   * The exit code of the command. A value of `null` indicates that the process did not exit normally.
   */
  exitCode: number | null;

  /**
   * The signal that caused the process to be terminated. A value of `null` indicates that no signal was received.
   */
  exitSignal: NodeJS.Signals | null;

  /**
   * The standard error output from the command.
   */
  stderr: string;

  /**
   * The standard output from the command.
   */
  stdout: string;
};

/**
 * Options for executing a command from the root directory.
 */
export type ExecFromRootOption = {
  /**
   * If true, suppresses the output of the command.
   */
  quiet?: boolean;

  /**
   * If true, ignores the exit code of the command.
   */
  ignoreExitCode?: boolean;

  /**
   * The input to be passed to the command.
   */
  stdin?: string;

  /**
   * The current working directory for the command execution.
   */
  cwd?: string | undefined;

  /**
   * If false, only returns the output of the command.
   */
  withDetails?: boolean;
};

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
export async function execFromRoot(command: string | string[], options?: ExecFromRootOption & { withDetails?: false }): Promise<string>;

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
export function execFromRoot(command: string | string[], options: ExecFromRootOption & { withDetails: true }): Promise<ExecFromRootResult>;

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
export function execFromRoot(command: string | string[], options: ExecFromRootOption = {}): Promise<string | ExecFromRootResult> {
  const {
    quiet = false,
    ignoreExitCode = false,
    stdin = "",
    cwd = undefined,
    withDetails = false
  } = options;
  if (Array.isArray(command)) {
    command = toCommandLine(command);
  }

  return new Promise((resolve, reject) => {
    console.log(`Executing command: ${command}`);
    const [cmd = "", ...args] = command.split(" ");

    const child = spawn(cmd, args, {
      cwd: getRootDir(cwd),
      stdio: "pipe",
      shell: true
    });

    let stdout = "";
    let stderr = "";

    child.stdin.write(stdin);
    child.stdin.end();

    child.stdout.on("data", (data: Buffer) => {
      if (!quiet) {
        process.stdout.write(data);
      }
      stdout += data.toString("utf-8");
    });

    child.stdout.on("end", () => {
      stdout = trimEnd(stdout, "\n");
    });

    child.stderr.on("data", (data: Buffer) => {
      if (!quiet) {
        process.stderr.write(data);
      }
      stderr += data.toString("utf-8");
    });

    child.stderr.on("end", () => {
      stderr = trimEnd(stderr, "\n");
    });

    child.on("close", (exitCode, exitSignal) => {
      if (exitCode !== 0 && !ignoreExitCode) {
        reject(new Error(`Command failed with exit code ${exitCode}\n${stderr}`));
      } else {
        resolve(!withDetails ? stdout : {
          exitCode,
          exitSignal,
          stderr,
          stdout
        });
      }
    });

    child.on("error", (err) => {
      if (!ignoreExitCode) {
        reject(err);
      } else {
        resolve(!withDetails ? stdout : {
          exitCode: null,
          exitSignal: null,
          stderr,
          stdout
        });
      }
    });
  });
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
 * Retrieves the root directory of the project.
 *
 * @param cwd - The current working directory to resolve from.
 * @returns The path to the root directory.
 * @throws If the root directory cannot be found.
 */
export function getRootDir(cwd?: string): string {
  const rootDir = packageDirectorySync({ cwd: cwd ?? process.cwd() });
  if (!rootDir) {
    throw new Error("Could not find root directory");
  }

  return toPosixPath(rootDir);
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
