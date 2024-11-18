/**
 * @packageDocumentation ChainedPromise
 * Contains utility functions for chaining functions in Obsidian.
 */

import type { App } from 'obsidian';

import type { MaybePromise } from '../Async.ts';
import type { ValueWrapper } from './App.ts';

import { addErrorHandler } from '../Async.ts';
import { getStackTrace } from '../Error.ts';
import { noop } from '../Function.ts';
import { getObsidianDevUtilsState } from './App.ts';
import { invokeAsyncAndLog } from './Logger.ts';

function getChainedPromiseWrapper(app: App): ValueWrapper<Promise<void>> {
  return getObsidianDevUtilsState(app, 'chainedPromise', Promise.resolve());
}

/**
 * Chains an asynchronous function to be executed after the previous function completes.
 *
 * @param app - The Obsidian application instance.
 * @param fn - The function to chain.
 */
export function chain(app: App, fn: () => MaybePromise<void>): void {
  void chainAndWait(app, fn);
}

/**
 * Chains an asynchronous function to be executed after the previous function completes and returns a promise that resolves when the function completes.
 *
 * @param app - The Obsidian application instance.
 * @param fn - The function to chain.
 */
export async function chainAndWait(app: App, fn: () => MaybePromise<void>): Promise<void> {
  const stackTrace = getStackTrace();
  const chainedPromiseWrapper = getChainedPromiseWrapper(app);
  chainedPromiseWrapper.value = chainedPromiseWrapper.value.then(() => addErrorHandler(() => invokeAsyncAndLog('chainAndWait', fn, stackTrace)));
  await chainedPromiseWrapper.value;
}

/**
 * Waits for all chained functions to complete.
 *
 * @param app - The Obsidian application instance.
 */
export async function waitAllChainedFunctions(app: App): Promise<void> {
  await chainAndWait(app, noop);
}
