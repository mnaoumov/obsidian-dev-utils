/**
 * @packageDocumentation Loop
 * Contains utility functions for looping in Obsidian.
 */

import type { MaybePromise } from '../Async.ts';

import { getLibDebugger } from '../Debug.ts';
import {
  ASYNC_ERROR_WRAPPER_MESSAGE,
  emitAsyncErrorEvent
} from '../Error.ts';

/**
 * Options for the loop function.
 */
export interface LoopOptions<T> {
  /**
   * An optional abort signal to cancel the loop.
   */
  abortSignal?: AbortSignal;
  /**
   * The function to build the notice message for each item.
   */
  buildNoticeMessage(item: T, iterationStr: string): string;
  /**
   * The items to loop over.
   */
  items: T[];
  /**
   * The function to process each item.
   */
  processItem(item: T): MaybePromise<void>;
  /**
   * Whether to continue the loop on error.
   */
  shouldContinueOnError?: boolean;
}

/**
 * Loops over a list of items and processes each item.
 *
 * @param options - The options for the loop.
 */
export async function loop<T>(options: LoopOptions<T>): Promise<void> {
  const items = options.items;
  let iterationCount = 0;
  const notice = new Notice('', 0);
  for (const item of items) {
    if (options.abortSignal?.aborted) {
      notice.hide();
      return;
    }
    iterationCount++;
    const iterationStr = `# ${iterationCount.toString()} / ${items.length.toString()}`;
    const message = options.buildNoticeMessage(item, iterationStr);
    notice.setMessage(message);
    getLibDebugger('Loop')(message);

    const asyncErrorWrapper = new Error(ASYNC_ERROR_WRAPPER_MESSAGE);
    try {
      await options.processItem(item);
    } catch (error) {
      if (options.shouldContinueOnError) {
        notice.hide();
        throw error;
      }
      asyncErrorWrapper.cause = error;
      emitAsyncErrorEvent(asyncErrorWrapper);
    }
  }
  notice.hide();
}
