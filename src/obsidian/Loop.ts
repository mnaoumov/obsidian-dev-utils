/**
 * @packageDocumentation
 *
 * Contains utility functions for looping in Obsidian.
 */

import type { Promisable } from 'type-fest';

import { Notice } from 'obsidian';

import { abortSignalNever } from '../AbortController.ts';
import {
  invokeAsyncSafely,
  requestAnimationFrameAsync
} from '../Async.ts';
import { getLibDebugger } from '../Debug.ts';
import {
  ASYNC_WRAPPER_ERROR_MESSAGE,
  CustomStackTraceError,
  emitAsyncErrorEvent,
  getStackTrace
} from '../Error.ts';
import { noop } from '../Function.ts';
import { addPluginCssClasses } from './Plugin/PluginContext.ts';

/**
 * Options for {@link loop}.
 */
export interface LoopOptions<T> {
  /**
   * An optional abort signal to cancel the loop.
   */
  abortSignal?: AbortSignal;

  /**
   * Build a notice message for each item.
   *
   * @param item - The current item.
   * @param iterationStr - A string representing the current iteration.
   * @returns A string to display in the notice.
   */
  buildNoticeMessage(item: T, iterationStr: string): string;

  /**
   * Items to loop over.
   */
  items: T[];

  /**
   * A timeout for the notice before it is shown.
   */
  noticeBeforeShownTimeoutInMilliseconds?: number;

  /**
   * A minimum timeout for the notice.
   */
  noticeMinTimeoutInMilliseconds?: number;

  /**
   * Process each item.
   *
   * @param item - The current item.
   */
  processItem(item: T): Promisable<void>;

  /**
   * A title of the progress bar.
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
   * A threshold for the UI update.
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
    abortSignal: abortSignalNever(),
    buildNoticeMessage() {
      throw new Error('buildNoticeMessage is required');
    },
    items: [],
    // eslint-disable-next-line no-magic-numbers -- Extracting magic number as a constant would be repetitive, as the value is used only once and its name would be the same as the property.
    noticeBeforeShownTimeoutInMilliseconds: 500,
    // eslint-disable-next-line no-magic-numbers -- Extracting magic number as a constant would be repetitive, as the value is used only once and its name would be the same as the property.
    noticeMinTimeoutInMilliseconds: 2000,
    processItem: noop,
    progressBarTitle: '',
    shouldContinueOnError: true,
    shouldShowProgressBar: true,
    // eslint-disable-next-line no-magic-numbers -- Extracting magic number as a constant would be repetitive, as the value is used only once and its name would be the same as the property.
    uiUpdateThresholdInMilliseconds: 100
  };

  const fullOptions: Required<LoopOptions<T>> = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  const stackTrace = getStackTrace(1);

  const items = fullOptions.items;
  let iterationCount = 0;
  let notice: Notice | null = null;
  let isDone = false;
  invokeAsyncSafely(() => showNotice());

  if (fullOptions.shouldShowProgressBar) {
    notice = new Notice('', 0);
  }
  const noticeMinTimeoutPromise = sleep(fullOptions.noticeMinTimeoutInMilliseconds);
  const progressBarEl = createEl('progress');
  addPluginCssClasses(progressBarEl, 'loop');
  progressBarEl.max = items.length;
  if (fullOptions.shouldShowProgressBar) {
    const fragment = createFragment();
    fragment.createDiv({ text: fullOptions.progressBarTitle });
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
    const iterationStr = `# ${String(iterationCount)} / ${String(items.length)}`;
    const message = fullOptions.buildNoticeMessage(item, iterationStr);
    if (!fullOptions.shouldShowProgressBar) {
      notice?.setMessage(message);
    }
    getLibDebugger('Loop')(message);

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
        throw new CustomStackTraceError('loop failed', stackTrace, error);
      }

      emitAsyncErrorEvent(new CustomStackTraceError(ASYNC_WRAPPER_ERROR_MESSAGE, stackTrace, error));
    }
    progressBarEl.value++;
  }
  if (notice) {
    await noticeMinTimeoutPromise;
  }
  notice?.hide();
  isDone = true;

  async function showNotice(): Promise<void> {
    await sleep(fullOptions.noticeBeforeShownTimeoutInMilliseconds);
    if (isDone) {
      return;
    }
    notice = new Notice('', 0);
  }
}
