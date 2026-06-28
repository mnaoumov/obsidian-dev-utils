/**
 * @file
 *
 * Contains utility functions for JSON.
 */

import type { Promisable } from 'type-fest';

import {
  existsSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import {
  readFile,
  writeFile
} from 'node:fs/promises';

import { toJson } from '../object-utils.ts';

/**
 * Options for {@link editJson}.
 */
export interface EditJsonOptions {
  /**
   * If `true`, skips editing if the file does not exist.
   *
   * @default `false`
   */
  readonly shouldSkipIfMissing?: boolean;
}

/**
 * Parameters for {@link editJson}.
 *
 * @typeParam T - The type of the data to be edited.
 */
export interface EditJsonParams<T> extends EditJsonOptions {
  /**
   * The function to edit the parsed JSON data.
   *
   * @param data - The parsed JSON data to edit.
   */
  editFn(this: void, data: T): Promisable<void>;

  /**
   * The path to the JSON file.
   */
  readonly path: string;
}

/**
 * Options for {@link editJsonSync}.
 */
export type EditJsonSyncOptions = EditJsonOptions;

/**
 * Parameters for {@link editJsonSync}.
 *
 * @typeParam T - The type of the data to be edited.
 */
export interface EditJsonSyncParams<T> extends EditJsonSyncOptions {
  /**
   * The function to edit the parsed JSON data.
   *
   * @param data - The parsed JSON data to edit.
   */
  editFn(this: void, data: T): void;

  /**
   * The path to the JSON file.
   */
  readonly path: string;
}

/**
 * Reads, edits, and writes back a JSON file using a provided edit function.
 *
 * @typeParam T - The type of the data to be edited.
 * @param params - The parameters for the function.
 * @returns A {@link Promise} that resolves when the file has been edited and written.
 */
export async function editJson<T>(params: EditJsonParams<T>): Promise<void> {
  const {
    editFn,
    path,
    shouldSkipIfMissing
  } = params;
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
 * @param params - The parameters for the function.
 */
export function editJsonSync<T>(params: EditJsonSyncParams<T>): void {
  const {
    editFn,
    path,
    shouldSkipIfMissing
  } = params;
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
