/**
 * @packageDocumentation JSON
 * Contains utility functions for JSON.
 */

import {
  readFile,
  writeFile
} from "node:fs/promises";
import type { MaybePromise } from "./Async.ts";
import { existsSync } from "node:fs";

/**
 * Reads a JSON file and parses its contents into a JavaScript object of type `T`.
 *
 * @typeParam T - The type to which the JSON content will be parsed.
 * @param path - The path to the JSON file.
 * @returns A promise that resolves with the parsed JSON object of type `T`.
 */
export async function readJson<T>(path: string): Promise<T> {
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
  await writeFile(path, toJson(data) + "\n");
}

/**
 * Options for editing JSON.
 */
export type EditJsonOptions = {
  /**
   * If true, skips editing if the file does not exist.
   */
  skipIfMissing?: boolean | undefined;
};

/**
 * Reads, edits, and writes back a JSON file using a provided edit function.
 *
 * @typeParam T - The type of the data to be edited.
 * @param path - The path to the JSON file.
 * @param editFn - The function to edit the parsed JSON data.
 * @param options - Additional options for editing.
 * @returns A promise that resolves when the file has been edited and written.
 */
export async function editJson<T>(
  path: string,
  editFn: (data: T) => MaybePromise<void>,
  options: EditJsonOptions = {}): Promise<void> {
  const {
    skipIfMissing
  } = options;
  if (skipIfMissing && !existsSync(path)) {
    return;
  }
  const data = await readJson<T>(path);
  await editFn(data);
  await writeJson(path, data);
}

/**
 * Options for converting an object to JSON.
 */
export type ToJsonOptions = {
  /**
   * If `true`, functions within the value will be handled and included in the JSON string. Defaults to `false`.
   */
  shouldHandleFunctions?: boolean;
  /**
   * Specifies the indentation of the JSON output. This can be a number of spaces or a string. Defaults to `2`.
   */
  space?: string | number | undefined;
};

/**
 * Converts a given value to a JSON string.
 *
 * @param value - The value to be converted to JSON. This can be of any type.
 * @param options - Options for customizing the JSON conversion process.
 * @returns The JSON string representation of the input value.
 */
export function toJson(value: unknown, options: ToJsonOptions = {}): string {
  const {
    shouldHandleFunctions = false,
    space = 2
  } = options;
  if (!shouldHandleFunctions) {
    return JSON.stringify(value, null, space);
  }

  const functionTexts: string[] = [];

  const replacer = (_: string, value: unknown): unknown => {
    if (typeof value === "function") {
      const index = functionTexts.length;
      functionTexts.push(value.toString());
      return `__FUNCTION_${index}`;
    }

    return value;
  };

  let json = JSON.stringify(value, replacer, space);
  json = json.replaceAll(/"__FUNCTION_(\d+)"/g, (_, indexStr: string) => functionTexts[parseInt(indexStr)] as string);
  return json;
}
