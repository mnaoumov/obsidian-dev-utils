import type { App } from 'obsidian';

import { addErrorHandler } from '../Async.ts';
import type { ValueWrapper } from './App.ts';
import { getObsidianDevUtilsState } from './App.ts';

function getChainedPromiseWrapper(app: App): ValueWrapper<Promise<void>> {
  return getObsidianDevUtilsState(app, 'chainedPromise', Promise.resolve());
}

/**
 * Chains an asynchronous function to be executed after the previous asynchronous function completes.
 *
 * @param app - The Obsidian application instance.
 * @param asyncFn - The asynchronous function to chain.
 */
export function chainAsyncFn(app: App, asyncFn: () => Promise<void>): void {
  const chainedPromiseWrapper = getChainedPromiseWrapper(app);
  chainedPromiseWrapper.value = chainedPromiseWrapper.value.then(() => addErrorHandler(asyncFn()));
}
