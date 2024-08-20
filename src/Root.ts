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

/**
 * Executes a command from the root directory of the project and returns the standard output.
 *
 * @param command - The command to execute, either as a string or an array of strings.
 * @param options - Configuration options for the execution.
 * @param options.quiet - If true, suppresses output to the console.
 * @param options.ignoreExitCode - If true, does not throw an error if the command exits with a non-zero code.
 * @param options.stdin - Input to pass to the command via stdin.
 * @param options.cwd - The current working directory to resolve from.
 * @returns A promise that resolves with the standard output of the command.
 */
export async function execFromRoot(command: string | string[], {
  quiet = false,
  ignoreExitCode = false,
  stdin = "",
  cwd
}: {
  quiet?: boolean,
  ignoreExitCode?: boolean,
  stdin?: string,
  cwd?: string | undefined
} = {}): Promise<string> {
  const { stdout } = await execFromRootWithStderr(command, { quiet, ignoreExitCode, stdin, cwd });
  return stdout;
}

/**
 * Executes a command from the root directory of the project and returns both the standard output and standard error.
 *
 * @param command - The command to execute, either as a string or an array of strings.
 * @param options - Configuration options for the execution.
 * @param options.quiet - If true, suppresses output to the console.
 * @param options.ignoreExitCode - If true, does not throw an error if the command exits with a non-zero code.
 * @param options.stdin - Input to pass to the command via stdin.
 * @param options.cwd - The current working directory to resolve from.
 * @returns A promise that resolves with an object containing the standard output and standard error of the command.
 */
export function execFromRootWithStderr(command: string | string[], {
  quiet = false,
  ignoreExitCode = false,
  stdin = "",
  cwd
}: {
  quiet?: boolean,
  ignoreExitCode?: boolean,
  stdin?: string,
  cwd?: string | undefined
} = {}): Promise<{ stdout: string, stderr: string }> {
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

    child.on("close", (code) => {
      if (code !== 0 && !ignoreExitCode) {
        reject(new Error(`Command failed with exit code ${code}\n${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    child.on("error", (err) => {
      if (!ignoreExitCode) {
        reject(err);
      } else {
        resolve({ stdout, stderr });
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
