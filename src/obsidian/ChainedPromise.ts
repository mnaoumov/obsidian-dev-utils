import type { App } from 'obsidian';

import type { MaybePromise } from '../Async.ts';
import { addErrorHandler } from '../Async.ts';
import { getStackTrace } from '../Error.ts';
import type { ValueWrapper } from './App.ts';
import { getObsidianDevUtilsState } from './App.ts';
import { invokeAsyncAndLog } from './Logger.ts';

function getChainedPromiseWrapper(app: App): ValueWrapper<Promise<void>> {
  return getObsidianDevUtilsState(app, 'chainedPromise', Promise.resolve());
}

/**
 * Chains an asynchronous function to be executed after the previous asynchronous function completes.
 *
 * @param app - The Obsidian application instance.
 * @param asyncFn - The asynchronous function to chain.
 */
export function chainAsyncFn(app: App, asyncFn: () => MaybePromise<void>): void {
  const stackTrace = getStackTrace();
  const chainedPromiseWrapper = getChainedPromiseWrapper(app);
  chainedPromiseWrapper.value = chainedPromiseWrapper.value.then(() => addErrorHandler(() => invokeAsyncAndLog('chainAsyncFn', asyncFn, stackTrace)));
}
