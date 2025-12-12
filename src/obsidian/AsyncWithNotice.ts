/**
 * @packageDocumentation
 *
 * Provides a utility to execute an asynchronous function with a notice.
 */

import type { Promisable } from 'type-fest';

import { Notice } from 'obsidian';

import type {
  RetryOptions,
  TimeoutContext
} from '../Async.ts';

import {
  retryWithTimeout,
  runWithTimeout
} from '../Async.ts';
import { t } from './i18n/i18n.ts';

/**
 * Options for {@link retryWithTimeoutNotice}.
 */
export interface RetryWithTimeoutNoticeOptions {
  /**
   * The operation function to execute.
   *
   * @param abortSignal - The abort signal to listen to.
   * @returns The result of the function.
   */
  operationFn(this: void, abortSignal: AbortSignal): Promisable<boolean>;

  /**
   * The name of the operation.
   */
  operationName?: string;

  /**
   * The retry options.
   */
  retryOptions?: RetryOptions;

  /**
   * The stack trace of the source function.
   */
  stackTrace?: string;
}

/**
 * Options for {@link runWithTimeout}.
 */
export interface RunWithTimeoutNoticeOptions<Result> {
  /**
   * The context of the function.
   */
  context?: unknown;
  /**
   * The operation function to execute.
   *
   * @param abortSignal - The abort signal to listen to.
   * @returns The result of the function.
   */
  operationFn(abortSignal: AbortSignal): Promisable<Result>;
  /**
   * The name of the operation.
   */
  operationName?: string;
  /**
   * The stack trace of the source function.
   */
  stackTrace?: string;

  /**
   * The maximum time to wait in milliseconds.
   */
  timeoutInMilliseconds: number;
}

/**
 * Retries the provided function until it returns true or the timeout is reached and displays a notice if the function times out.
 *
 * @param options - The options for the function.
 * @returns A {@link Promise} that resolves when the function returns true or rejects when the timeout is reached.
 */
export async function retryWithTimeoutNotice(options: RetryWithTimeoutNoticeOptions): Promise<void> {
  return retryWithTimeout({
    ...options,
    onTimeout: onTimeoutNotice
  });
}

/**
 * Executes a function with a timeout and displays a notice if the function times out.
 *
 * @typeParam R - The type of the result from the asynchronous function.
 * @param options - The options for the function.
 * @returns The result of the function.
 */
export async function runWithTimeoutNotice<Result>(options: RunWithTimeoutNoticeOptions<Result>): Promise<Result> {
  return runWithTimeout({
    ...options,
    onTimeout: onTimeoutNotice
  });
}

function onTimeoutNotice(ctx: TimeoutContext): void {
  const startTime = Math.trunc(performance.now() - ctx.duration);
  let runningTimeEl: HTMLSpanElement;
  let intervalId: number;
  const SECOND_IN_MILLISECONDS = 1000;

  const notice = new Notice(createFragment((f) => {
    if (ctx.operationName) {
      f.appendText(t(($) => $.obsidianDevUtils.asyncWithNotice.operation));
      f.appendText(': ');
      f.appendText(ctx.operationName);
      f.createEl('br');
    }
    f.appendText(t(($) => $.obsidianDevUtils.asyncWithNotice.timedOut, { duration: ctx.duration }));
    f.createEl('br');
    f.appendText(t(($) => $.obsidianDevUtils.asyncWithNotice.runningFor));
    f.appendText(' ');
    runningTimeEl = f.createSpan();
    f.appendText(' ');
    f.appendText(t(($) => $.obsidianDevUtils.asyncWithNotice.milliseconds));
    f.createEl('br');
    f.appendText(t(($) => $.obsidianDevUtils.asyncWithNotice.terminateOperation));
    f.createEl('br');
    const button = f.createEl('button', {
      text: t(($) => $.obsidianDevUtils.buttons.cancel)
    });
    button.addEventListener('click', () => {
      ctx.terminateOperation();
      clearInterval(intervalId);
      notice.hide();
    });
  }));

  updateRunningTime();
  intervalId = window.setInterval(updateRunningTime, SECOND_IN_MILLISECONDS);

  ctx.onOperationCompleted(() => {
    clearInterval(intervalId);
    notice.hide();
  });

  function updateRunningTime(): void {
    const runningTimeInMilliseconds = Math.max(ctx.duration, Math.round((performance.now() - startTime) / SECOND_IN_MILLISECONDS) * SECOND_IN_MILLISECONDS);
    runningTimeEl.textContent = String(runningTimeInMilliseconds);
  }
}
