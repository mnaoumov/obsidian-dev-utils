/**
 * @packageDocumentation
 *
 * This module provides utilities for interacting with the Obsidian CLI.
 */

/* v8 ignore start -- Requires Obsidian CLI to be installed and running. */

import type { Promisable } from 'type-fest';

import { exec } from './exec.ts';

/**
 * Evaluates a function or expression inside the running Obsidian instance
 * via the Obsidian CLI and returns the parsed result.
 *
 * When passing a function, it is serialized via `toString()` and invoked as an IIFE.
 * The function must be self-contained — closures over local variables will not work.
 *
 * When passing a string, it is evaluated as a raw JavaScript expression.
 *
 * The result is `JSON.stringify`'d on the Obsidian side and parsed back.
 *
 * @param fnOrExpression - A self-contained function or a raw JS expression string.
 * @returns A {@link Promise} that resolves to the return value.
 */
export async function evalObsidianCli<T>(fnOrExpression: (() => Promisable<T>) | string): Promise<T> {
  const expression = typeof fnOrExpression === 'function'
    ? `await (${fnOrExpression.toString()})()`
    : `await (${fnOrExpression})`;
  const resultJson = await exec(['obsidian', 'eval', `JSON.stringify(${expression})`], { isQuiet: true });
  return JSON.parse(resultJson) as T;
}

/* v8 ignore stop */
