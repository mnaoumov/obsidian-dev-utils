/**
 * @fileoverview Contains utility functions for JSON.
 */

import {
  readFile,
  writeFile
} from "node:fs/promises";
import { resolvePathFromRoot } from "./Root.ts";
import type { MaybePromise } from "./Async.ts";
import { toJson } from "./Object.ts";
import { existsSync } from "node:fs";

/**
 * Reads a JSON file and parses its contents into a JavaScript object of type `T`.
 *
 * @template T - The type to which the JSON content will be parsed.
 * @param path - The path to the JSON file.
 * @returns A promise that resolves with the parsed JSON object of type `T`.
 */
export async function readJson<T>(path: string): Promise<T> {
  path = resolvePathFromRoot(path);
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

/**
 * Writes a JavaScript object to a JSON file.
 *
 * @param path - The path to the JSON file.
 * @param data - The data to write to the JSON file.
 * @returns A promise that resolves when the file has been written.
 */
export async function writeJson(path: string, data: unknown): Promise<void> {
  path = resolvePathFromRoot(path);
  await writeFile(path, toJson(data) + "\n");
}

/**
 * Reads, edits, and writes back a JSON file using a provided edit function.
 *
 * @template T - The type of the data to be edited.
 * @param path - The path to the JSON file.
 * @param editFn - The function to edit the parsed JSON data.
 * @param options - Additional options for editing.
 * @param options.skipIfMissing - If true, skips editing if the file does not exist.
 * @returns A promise that resolves when the file has been edited and written.
 */
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
