/**
 * @packageDocumentation
 *
 * Contains utility functions for looping in Obsidian.
 */

import type { Promisable } from 'type-fest';

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
   * The minimum timeout for the notice.
   */
  noticeMinTimeoutInMilliseconds?: number;
  /**
   * The function to process each item.
   */
  processItem(item: T): Promisable<void>;
  /**
   * The title of the progress bar.
   */
  progressBarTitle?: string;
  /**
   * Whether to continue the loop on error.
   */
  shouldContinueOnError?: boolean;
  /**
   * Whether to show a progress bar.
   */
  shouldShowProgressBar?: boolean;
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
  const DEFAULT_NOTICE_MIN_TIMEOUT_IN_MILLISECONDS = 2000;
  const noticeMinTimeoutPromise = sleep(options.noticeMinTimeoutInMilliseconds ?? DEFAULT_NOTICE_MIN_TIMEOUT_IN_MILLISECONDS);
  const progressBarEl = createEl('progress');
  progressBarEl.max = items.length;
  if (options.shouldShowProgressBar) {
    const fragment = createFragment();
    if (options.progressBarTitle) {
      fragment.appendText(options.progressBarTitle);
    }
    fragment.appendChild(progressBarEl);
    notice.setMessage(fragment);
  }
  for (const item of items) {
    if (options.abortSignal?.aborted) {
      notice.hide();
      return;
    }
    iterationCount++;
    const iterationStr = `# ${iterationCount.toString()} / ${items.length.toString()}`;
    const message = options.buildNoticeMessage(item, iterationStr);
    if (!options.shouldShowProgressBar) {
      notice.setMessage(message);
    }
    getLibDebugger('Loop')(message);

    const asyncErrorWrapper = new Error(ASYNC_ERROR_WRAPPER_MESSAGE);
    try {
      await options.processItem(item);
    } catch (error) {
      console.error('Error processing item', item);
      if (!options.shouldContinueOnError) {
        notice.hide();
        throw error;
      }
      asyncErrorWrapper.cause = error;
      emitAsyncErrorEvent(asyncErrorWrapper);
    }
    progressBarEl.value++;
  }
  await noticeMinTimeoutPromise;
  notice.hide();
}
