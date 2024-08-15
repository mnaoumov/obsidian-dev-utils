import { spawn } from "node:child_process";
import {
  relative,
  resolve
} from "node:path/posix";
import { tsImport } from "tsx/esm/api";
import process from "node:process";
import { packageDirectorySync } from "pkg-dir";
import { pathToFileURL } from "node:url";
import { toPosixPath } from "./Path.ts";
import { trimEnd } from "./String.ts";

export async function execFromRoot(command: string, {
  quiet = false,
  ignoreExitCode = false,
  stdin = ""
}: {
  quiet?: boolean,
  ignoreExitCode?: boolean
  stdin?: string
} = {}): Promise<string> {
  const { stdout } = await execFromRootWithStderr(command, { quiet, ignoreExitCode, stdin });
  return stdout;
}

export async function execFromRootWithStderr(command: string, {
  quiet = false,
  ignoreExitCode = false,
  stdin = ""
}: {
  quiet?: boolean,
  ignoreExitCode?: boolean
  stdin?: string
} = {}): Promise<{ stdout: string, stderr: string }> {
  const { promise, resolve, reject } = Promise.withResolvers<{ stdout: string, stderr: string }>();

  console.log(`Executing command: ${command}`);
  const [cmd = "", ...args] = command.split(" ");

  const child = spawn(cmd, args, {
    cwd: getRootDir(),
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

  return await promise;
}

export async function tsImportFromRoot<T>(specifier: string): Promise<T> {
  const rootDir = getRootDir();
  const rootUrl = pathToFileURL(rootDir).href;
  return await tsImport(specifier, rootUrl) as T;
}

export function resolvePathFromRoot(path: string): string {
  return resolve(getRootDir(), path);
}

export function getRootDir(): string {
  const rootDir = packageDirectorySync();
  if (!rootDir) {
    throw new Error("Could not find root directory");
  }

  return toPosixPath(rootDir);
}

export function toRelativeFromRoot(path: string): string {
  const rootDir = getRootDir();
  path = toPosixPath(path);
  return relative(rootDir, path);
}
