import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { tsImport } from "tsx/esm/api";
import process from "node:process";
import { packageDirectory } from "pkg-dir";
import { pathToFileURL } from "node:url";

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

export function execFromRootWithStderr(command: string, {
  quiet = false,
  ignoreExitCode = false,
  stdin = ""
}: {
  quiet?: boolean,
  ignoreExitCode?: boolean
  stdin?: string
} = {}): Promise<{ stdout: string, stderr: string }> {
  return new Promise(async (resolve, reject) => {
    console.log(`Executing command: ${command}`);
    const [cmd = "", ...args] = command.split(" ");

    const child = spawn(cmd, args, {
      cwd: await getRootDir(),
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
      if (stdout.endsWith("\n")) {
        stdout = stdout.slice(0, -1);
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      if (!quiet) {
        process.stderr.write(data);
      }
      stderr += data.toString("utf8");
    });

    child.stderr.on("end", () => {
      if (stderr.endsWith("\n")) {
        stderr = stderr.slice(0, -1);
      }
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

export async function tsImportFromRoot<T>(specifier: string): Promise<T> {
  const rootDir = await getRootDir();
  const rootUrl = pathToFileURL(rootDir).toString();
  return await tsImport(specifier, rootUrl) as T;
}

export async function resolvePathFromRoot(path: string): Promise<string> {
  return resolve(await getRootDir(), path);
}

export async function getRootDir(): Promise<string> {
  const rootDir = await packageDirectory();
  if (!rootDir) {
    throw new Error("Could not find root directory");
  }

  return rootDir;
}
