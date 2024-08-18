import {
  readFile,
  writeFile
} from "node:fs/promises";
import { resolvePathFromRoot } from "./Root.ts";
import type { MaybePromise } from "./Async.ts";
import { toJson } from "./Object.ts";
import { existsSync } from "node:fs";

export async function readJson<T>(path: string): Promise<T> {
  path = resolvePathFromRoot(path);
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  path = resolvePathFromRoot(path);
  await writeFile(path, toJson(data) + "\n");
}

export async function editJson<T>(
  path: string,
  editFn: (data: T) => MaybePromise<void>,
  {
    skipIfMissing
  }: {
    skipIfMissing?: boolean | undefined
  } = {}): Promise<void> {
  if (skipIfMissing && !existsSync(resolvePathFromRoot(path))) {
    return;
  }
  const data = await readJson<T>(path);
  await editFn(data);
  await writeJson(path, data);
}
