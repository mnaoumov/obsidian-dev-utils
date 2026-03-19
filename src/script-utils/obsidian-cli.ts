/**
 * @packageDocumentation
 *
 * This module provides utilities for interacting with the Obsidian CLI.
 */

/* v8 ignore start -- Requires Obsidian CLI to be installed and running. */

import type { App } from 'obsidian';
import type { Promisable } from 'type-fest';

import { getFunctionExpressionString } from '../function.ts';
import { trimStart } from '../string.ts';
import { exec } from './exec.ts';

/**
 * Parameters for {@link evalObsidianCli}.
 */
export interface EvalObsidianCliParams<Args extends unknown[], Result> {
  /**
   * Additional arguments to pass after `app`. Must be JSON-serializable.
   */
  args?: Args;

  /**
   * The function to evaluate in the Obsidian context.
   */
  fn: (app: App, ...args: Args) => Promisable<Result>;

  /**
   * The path to the Obsidian vault.
   */
  vaultPath: string;
}

/**
 * Evaluates a function inside the running Obsidian instance
 * via the Obsidian CLI and returns the parsed result.
 *
 * The function receives `app` as its first argument, followed by any additional `args`.
 * It is serialized via `toString()` and invoked as an IIFE.
 * The function must be self-contained — closures over local variables will not work.
 * Pass any needed values as `args` — they are JSON-serialized and deserialized on the Obsidian side.
 *
 * The result is `JSON.stringify`'d on the Obsidian side and parsed back.
 *
 * @param params - The parameters for the function to evaluate.
 * @returns A {@link Promise} that resolves to the return value of `fn`.
 */
export async function evalObsidianCli<Args extends unknown[], Result>(params: EvalObsidianCliParams<Args, Result>): Promise<Result> {
  const { args, fn, vaultPath } = params;
  const fnString = getFunctionExpressionString(fn);
  const argsStr = args && args.length > 0 ? `, ...${JSON.stringify(args) as string}` : '';
  const expression = `await (${fnString})(app${argsStr})`;
  const resultStr = await exec(['obsidian', 'eval', `code=(async () => JSON.stringify(${expression}))()`, vaultPath], { cwd: vaultPath, isQuiet: true });
  const resultJson = trimStart(resultStr, '=> ');
  return JSON.parse(resultJson) as Result;
}

/* v8 ignore stop */
