/**
 * @file
 *
 * Contains utility functions for looping in Obsidian.
 */

import type { Promisable } from 'type-fest';

import { Notice } from 'obsidian';

import type { PluginNoticeComponent } from './components/plugin-notice-component.ts';

import { abortSignalNever } from '../abort-controller.ts';
import {
  invokeAsyncSafely,
  requestAnimationFrameAsync
} from '../async.ts';
import { getLibDebugger } from '../debug.ts';
import {
  ASYNC_WRAPPER_ERROR_MESSAGE,
  CustomStackTraceError,
  emitAsyncErrorEvent,
  getStackTrace
} from '../error.ts';
import { noop } from '../function.ts';
import { addPluginCssClasses } from './plugin/plugin-context.ts';

/**
 * Parameters for the {@link LoopParams.buildNoticeMessage} callback.
 *
 * @typeParam T - The type of the items to loop over.
 */
export interface LoopBuildNoticeMessageParams<T> {
  /**
   * The current item.
   */
  readonly item: T;

  /**
   * A string representing the current iteration.
   */
  readonly iterationStr: string;
}

/**
 * Options for {@link loop}.
 *
 * @typeParam T - The type of the items to loop over.
 */
export interface LoopParams<T> {
  /**
   * An optional abort signal to cancel the loop.
   */
  readonly abortSignal?: AbortSignal;

  /**
   * Build a notice message for each item.
   *
   * @param params - The parameters for building the notice message.
   * @returns A string to display in the notice.
   */
  buildNoticeMessage(params: LoopBuildNoticeMessageParams<T>): string;

  /**
   * Items to loop over.
   */
  readonly items: T[];

  /**
   * A timeout for the notice before it is shown.
   *
   * @default `500`
   */
  readonly noticeBeforeShownTimeoutInMilliseconds?: number;

  /**
   * A minimum timeout for the notice.
   *
   * @default `2000`
   */
  readonly noticeMinTimeoutInMilliseconds?: number;

  /**
   * A component to show notices.
   */
  readonly pluginNoticeComponent: null | PluginNoticeComponent;

  /**
   * Process each item.
   *
   * @param item - The current item.
   */
  processItem(item: T): Promisable<void>;

  /**
   * A title of the progress bar.
   *
   * @default `''`
   */
  readonly progressBarTitle?: string;

  /**
   * Whether to continue the loop on error.
   *
   * @default `true`
   */
  readonly shouldContinueOnError?: boolean;

  /**
   * Whether to show a notice.
   *
   * @default `true`
   */
  readonly shouldShowNotice?: boolean;

  /**
   * Whether to show a progress bar.
   *
   * @default `true`
   */
  readonly shouldShowProgressBar?: boolean;

  /**
   * A threshold for the UI update.
   *
   * @default `100`
   */
  readonly uiUpdateThresholdInMilliseconds?: number;
}

/**
 * Loops over a list of items and processes each item.
 *
 * @typeParam T - The type of the items to loop over.
 * @param params - The parameters for the loop.
 */
export async function loop<T>(params: LoopParams<T>): Promise<void> {
  const DEFAULT_OPTIONS = {
    abortSignal: abortSignalNever(),
    /* v8 ignore start -- buildNoticeMessage is required in LoopParams and always overridden by the spread. */
    buildNoticeMessage(): string {
      throw new Error('buildNoticeMessage is required');
    },
    /* v8 ignore stop */
    items: [],
    // eslint-disable-next-line no-magic-numbers -- Extracting magic number as a constant would be repetitive, as the value is used only once and its name would be the same as the property.
    noticeBeforeShownTimeoutInMilliseconds: 500,
    // eslint-disable-next-line no-magic-numbers -- Extracting magic number as a constant would be repetitive, as the value is used only once and its name would be the same as the property.
    noticeMinTimeoutInMilliseconds: 2000,
    processItem: noop,
    progressBarTitle: '',
    shouldContinueOnError: true,
    shouldShowNotice: true,
    shouldShowProgressBar: true,
    // eslint-disable-next-line no-magic-numbers -- Extracting magic number as a constant would be repetitive, as the value is used only once and its name would be the same as the property.
    uiUpdateThresholdInMilliseconds: 100
  };

  const fullOptions: Required<LoopParams<T>> = {
    ...DEFAULT_OPTIONS,
    ...params
  };

  const stackTrace = getStackTrace(1);

  const items = fullOptions.items;
  let iterationCount = 0;
  let notice = null as Notice | null;
  let isDone = false;
  invokeAsyncSafely(() => showNotice());

  const noticeMinTimeoutPromise = sleep(fullOptions.noticeMinTimeoutInMilliseconds);
  const progressBarEl = createEl('progress');
  addPluginCssClasses(progressBarEl, 'loop');
  progressBarEl.max = items.length;

  let lastUIUpdateTimestamp = performance.now();

  for (const item of items) {
    if (fullOptions.abortSignal.aborted) {
      notice?.hide();
      return;
    }
    iterationCount++;
    const iterationStr = `# ${String(iterationCount)} / ${String(items.length)}`;
    const message = fullOptions.buildNoticeMessage({ item, iterationStr });
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
        throw new CustomStackTraceError({
          cause: error,
          message: 'loop failed',
          stackTrace
        });
      }

      emitAsyncErrorEvent(
        new CustomStackTraceError({
          cause: error,
          message: ASYNC_WRAPPER_ERROR_MESSAGE,
          stackTrace
        })
      );
    }
    progressBarEl.value++;
  }
  if (notice) {
    await noticeMinTimeoutPromise;
  }
  notice?.hide();
  isDone = true;

  async function showNotice(): Promise<void> {
    if (!fullOptions.shouldShowNotice) {
      return;
    }
    await sleep(fullOptions.noticeBeforeShownTimeoutInMilliseconds);
    if (isDone) {
      return;
    }
    notice = params.pluginNoticeComponent?.showNotice('', {}) ?? null;
    if (!fullOptions.shouldShowProgressBar) {
      return;
    }
    const fragment = createFragment();
    fragment.createDiv({ text: fullOptions.progressBarTitle });
    fragment.appendChild(progressBarEl);
    notice?.setMessage(fragment);
  }
}
