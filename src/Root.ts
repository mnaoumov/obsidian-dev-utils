import { spawn } from "node:child_process";
import {
  relative,
  resolve
} from "./Path.ts";
import { tsImport } from "tsx/esm/api";
import process from "node:process";
import { packageDirectorySync } from "pkg-dir";
import { pathToFileURL } from "node:url";
import { toPosixPath } from "./Path.ts";
import { trimEnd } from "./String.ts";
import { toCommandLine } from "./bin/cli.ts";

export async function execFromRoot(command: string | string[], {
  quiet = false,
  ignoreExitCode = false,
  stdin = "",
  cwd
}: {
  quiet?: boolean,
  ignoreExitCode?: boolean
  stdin?: string,
  cwd?: string | undefined
} = {}): Promise<string> {
  const { stdout } = await execFromRootWithStderr(command, { quiet, ignoreExitCode, stdin, cwd });
  return stdout;
}

export function execFromRootWithStderr(command: string | string[], {
  quiet = false,
  ignoreExitCode = false,
  stdin = "",
  cwd
}: {
  quiet?: boolean,
  ignoreExitCode?: boolean
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
      stdout += data.toString("utf8");
    });

    child.stdout.on("end", () => {
      stdout = trimEnd(stdout, "\n");
    });

    child.stderr.on("data", (data: Buffer) => {
      if (!quiet) {
        process.stderr.write(data);
      }
      stderr += data.toString("utf8");
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

export async function tsImportFromRoot<T>(specifier: string, cwd?: string): Promise<T> {
  const rootDir = getRootDir(cwd);
  const rootUrl = pathToFileURL(rootDir).href;
  return await tsImport(specifier, rootUrl) as T;
}

export function resolvePathFromRoot(path: string, cwd?: string): string {
  return resolve(getRootDir(cwd), path);
}

export function getRootDir(cwd?: string): string {
  const rootDir = packageDirectorySync({ cwd: cwd ?? process.cwd() });
  if (!rootDir) {
    throw new Error("Could not find root directory");
  }

  return toPosixPath(rootDir);
}

export function toRelativeFromRoot(path: string, cwd?: string): string {
  const rootDir = getRootDir(cwd);
  path = toPosixPath(path);
  return relative(rootDir, path);
}
