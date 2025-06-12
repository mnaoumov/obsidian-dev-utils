/**
 * @packageDocumentation
 *
 * Contains utility functions for looping in Obsidian.
 */

import type { Promisable } from 'type-fest';

import { Notice } from 'obsidian';

import { requestAnimationFrameAsync } from '../Async.ts';
import { getLibDebugger } from '../Debug.ts';
import {
  ASYNC_ERROR_WRAPPER_MESSAGE,
  emitAsyncErrorEvent
} from '../Error.ts';
import { noop } from '../Function.ts';

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
  /**
   * The threshold for the UI update.
   */
  uiUpdateThresholdInMilliseconds?: number;
}

/**
 * Loops over a list of items and processes each item.
 *
 * @param options - The options for the loop.
 */
export async function loop<T>(options: LoopOptions<T>): Promise<void> {
  const DEFAULT_OPTIONS: Required<LoopOptions<T>> = {
    abortSignal: AbortSignal.any([]),
    buildNoticeMessage() {
      throw new Error('buildNoticeMessage is required');
    },
    items: [],
    // eslint-disable-next-line no-magic-numbers
    noticeMinTimeoutInMilliseconds: 2000,
    processItem: noop,
    progressBarTitle: '',
    shouldContinueOnError: true,
    shouldShowProgressBar: true,
    // eslint-disable-next-line no-magic-numbers
    uiUpdateThresholdInMilliseconds: 100
  };

  const fullOptions: Required<LoopOptions<T>> = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  const items = fullOptions.items;
  let iterationCount = 0;
  let notice: Notice | null = null;;
  if (fullOptions.shouldShowProgressBar) {
    notice = new Notice('', 0);
  }
  const noticeMinTimeoutPromise = sleep(fullOptions.noticeMinTimeoutInMilliseconds);
  const progressBarEl = createEl('progress');
  progressBarEl.max = items.length;
  if (fullOptions.shouldShowProgressBar) {
    const fragment = createFragment();
    if (fullOptions.progressBarTitle) {
      fragment.createDiv({ text: fullOptions.progressBarTitle });
    }
    fragment.appendChild(progressBarEl);
    notice?.setMessage(fragment);
  }

  let lastUIUpdateTimestamp = performance.now();

  for (const item of items) {
    if (fullOptions.abortSignal.aborted) {
      notice?.hide();
      return;
    }
    iterationCount++;
    const iterationStr = `# ${iterationCount.toString()} / ${items.length.toString()}`;
    const message = fullOptions.buildNoticeMessage(item, iterationStr);
    if (!fullOptions.shouldShowProgressBar) {
      notice?.setMessage(message);
    }
    getLibDebugger('Loop')(message);

    const asyncErrorWrapper = new Error(ASYNC_ERROR_WRAPPER_MESSAGE);
    try {
      if (performance.now() - lastUIUpdateTimestamp > fullOptions.uiUpdateThresholdInMilliseconds) {
        await requestAnimationFrameAsync();
        lastUIUpdateTimestamp = performance.now();
      }
      await fullOptions.processItem(item);
    } catch (error) {
      console.error('Error processing item', item);
      if (!fullOptions.shouldContinueOnError) {
        notice?.hide();
        throw error;
      }
      asyncErrorWrapper.cause = error;
      emitAsyncErrorEvent(asyncErrorWrapper);
    }
    progressBarEl.value++;
  }
  await noticeMinTimeoutPromise;
  notice?.hide();
}
