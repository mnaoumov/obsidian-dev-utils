/**
 * @file Contains utility functions for executing commands from the root directory of a project,
 * resolving paths relative to the root, and importing TypeScript modules from the root.
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
import { toCommandLine } from "./bin/cli.ts";

type ExecResult = {
  exitCode: number | null;
  exitSignal: NodeJS.Signals | null;
  stderr: string;
  stdout: string;
};

/**
 * Executes a command from the root directory.
 * @param command - The command to execute. Can be a string or an array of strings.
 * @param options - The options for the execution.
 * @param options.quiet - If true, suppresses the output of the command. Default is false.
 * @param options.ignoreExitCode - If true, ignores the exit code of the command. Default is false.
 * @param options.stdin - The input to be passed to the command. Default is undefined.
 * @param options.cwd - The current working directory for the command execution. Default is undefined.
 * @param options.withDetails - If false, only returns the output of the command. Default is false.
 * @returns A promise that resolves with the output of the command.
 */
export async function execFromRoot(command: string | string[], options: {
  quiet?: boolean,
  ignoreExitCode?: boolean,
  stdin?: string,
  cwd?: string | undefined,
  withDetails: false
}): Promise<string>;

/**
 * Executes a command from the root directory of the project.
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @param options.quiet - If set to true, suppresses the output of the command. Default is false.
 * @param options.ignoreExitCode - If set to true, ignores the exit code of the command. Default is false.
 * @param options.stdin - The input to be passed to the command. Default is undefined.
 * @param options.cwd - The current working directory for the command execution. Default is undefined.
 * @param options.withDetails - If set to true, returns detailed information about the execution. Default is true.
 * @returns A promise that resolves to the execution result.
 */
export function execFromRoot(command: string | string[], options: {
  quiet?: boolean,
  ignoreExitCode?: boolean,
  stdin?: string,
  cwd?: string | undefined,
  withDetails: true
}): Promise<ExecResult>;

/**
 * Executes a command from the root directory of the project.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @param options.quiet - If set to true, suppresses the output of the command. Default is false.
 * @param options.ignoreExitCode - If set to true, ignores the exit code of the command. Default is false.
 * @param options.stdin - The input to be passed to the command. Default is undefined.
 * @param options.cwd - The current working directory for the command execution. Default is undefined.
 * @param options.withDetails - Whether to include detailed information in the output. Default is false.
 *
 * @returns A Promise that resolves with the output of the command or an ExecResult object.
 *          The ExecResult object contains the exit code, exit signal, stderr, and stdout.
 *
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is false.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is true,
 *         the error is resolved with the stdout and stderr.
 */
export function execFromRoot(command: string | string[],
  {
    quiet = false,
    ignoreExitCode = false,
    stdin = "",
    cwd,
    withDetails = false
  }: {
    quiet?: boolean,
    ignoreExitCode?: boolean,
    stdin?: string,
    cwd?: string | undefined,
    withDetails: boolean
  }): Promise<string | ExecResult> {
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
        resolve(withDetails ? stdout : {
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
        resolve(withDetails ? stdout : {
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
