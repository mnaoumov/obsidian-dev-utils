/**
 * @packageDocumentation
 *
 * Contains utility functions for JSON.
 */

import type { Promisable } from 'type-fest';

import { toJson } from '../ObjectUtils.ts';
import {
  existsSync,
  readFile,
  readFileSync,
  writeFile,
  writeFileSync
} from './NodeModules.ts';

/**
 * Options for {@link editJson}.
 */
export interface EditJsonOptions {
  /**
   * If true, skips editing if the file does not exist.
   */
  shouldSkipIfMissing?: boolean;
}

/**
 * Reads, edits, and writes back a JSON file using a provided edit function.
 *
 * @typeParam T - The type of the data to be edited.
 * @param path - The path to the JSON file.
 * @param editFn - The function to edit the parsed JSON data.
 * @param options - Additional options for editing.
 * @returns A {@link Promise} that resolves when the file has been edited and written.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
export async function editJson<T>(
  path: string,
  editFn: (data: T) => Promisable<void>,
  options: EditJsonOptions = {}
): Promise<void> {
  const {
    shouldSkipIfMissing
  } = options;
  if (shouldSkipIfMissing && !existsSync(path)) {
    return;
  }
  const data = await readJson<T>(path);
  await editFn(data);
  await writeJson(path, data);
}

/**
 * Reads, edits, and writes back a JSON file using a provided edit function.
 *
 * @typeParam T - The type of the data to be edited.
 * @param path - The path to the JSON file.
 * @param editFn - The function to edit the parsed JSON data.
 * @param options - Additional options for editing.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
export function editJsonSync<T>(
  path: string,
  editFn: (data: T) => void,
  options: EditJsonOptions = {}
): void {
  const {
    shouldSkipIfMissing
  } = options;
  if (shouldSkipIfMissing && !existsSync(path)) {
    return;
  }
  const data = readJsonSync<T>(path);
  editFn(data);
  writeJsonSync(path, data);
}

/**
 * Reads a JSON file and parses its contents into a JavaScript object of type `T`.
 *
 * @typeParam T - The type to which the JSON content will be parsed.
 * @param path - The path to the JSON file.
 * @returns A {@link Promise} that resolves with the parsed JSON object of type `T`.
 */
export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf-8')) as T;
}

/**
 * Reads a JSON file and parses its contents into a JavaScript object of type `T`.
 *
 * @typeParam T - The type to which the JSON content will be parsed.
 * @param path - The path to the JSON file.
 * @returns The parsed JSON object of type `T`.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
export function readJsonSync<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

/**
 * Writes a JavaScript object to a JSON file.
 *
 * @param path - The path to the JSON file.
 * @param data - The data to write to the JSON file.
 * @returns A {@link Promise} that resolves when the file has been written.
 */
export async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, `${toJson(data)}\n`);
}

/**
 * Writes a JavaScript object to a JSON file.
 *
 * @param path - The path to the JSON file.
 * @param data - The data to write to the JSON file.
 */
export function writeJsonSync(path: string, data: unknown): void {
  writeFileSync(path, `${toJson(data)}\n`);
}
