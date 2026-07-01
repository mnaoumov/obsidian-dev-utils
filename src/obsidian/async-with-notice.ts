/**
 * @file
 *
 * Provides a utility to execute an asynchronous function with a notice.
 */

import type { Notice } from 'obsidian';
import type { Promisable } from 'type-fest';

import type {
  RetryOptions,
  TimeoutContext
} from '../async.ts';
import type { ValueProvider } from '../value-provider.ts';
import type { PluginNoticeComponent } from './components/plugin-notice-component.ts';

import {
  invokeAsyncSafely,
  retryWithTimeout,
  runWithTimeout
} from '../async.ts';
import { getDebugger } from '../debug.ts';
import { resolveValue } from '../value-provider.ts';
import { t } from './i18n/i18n.ts';

/**
 * Options for {@link retryWithTimeoutNotice}.
 */
export interface RetryWithTimeoutNoticeParams {
  /**
   * Custom content to show in the notice instead of the default timed-out message. Resolved only if
   * the operation exceeds the timeout, shown as a permanent notice, and hidden when the operation
   * completes.
   */
  readonly content?: ValueProvider<DocumentFragment | string>;

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
  readonly operationName?: string;

  /**
   * Plugin notice component to show notices.
   */
  readonly pluginNoticeComponent: PluginNoticeComponent;

  /**
   * The retry options.
   */
  readonly retryOptions?: RetryOptions;

  /**
   * Whether to show a timeout notice.
   *
   * @default `true`
   */
  readonly shouldShowTimeoutNotice?: boolean;

  /**
   * The stack trace of the source function.
   */
  readonly stackTrace?: string;
}

/**
 * Options for {@link runWithTimeout}.
 *
 * @typeParam Result - The type of the result from the operation function.
 */
export interface RunWithTimeoutNoticeParams<Result> {
  /**
   * Custom content to show in the notice instead of the default timed-out message. Resolved only if
   * the operation exceeds {@link RunWithTimeoutNoticeParams.timeoutInMilliseconds}, shown as a
   * permanent notice, and hidden when the operation completes.
   */
  readonly content?: ValueProvider<DocumentFragment | string>;

  /**
   * The context of the function.
   */
  readonly context?: unknown;

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
  readonly operationName?: string;

  /**
   * Plugin notice component to show notices.
   */
  readonly pluginNoticeComponent: PluginNoticeComponent;

  /**
   * Whether to show a timeout notice.
   *
   * @default `true`
   */
  readonly shouldShowTimeoutNotice?: boolean;

  /**
   * The stack trace of the source function.
   */
  readonly stackTrace?: string;

  /**
   * The maximum time to wait in milliseconds.
   */
  readonly timeoutInMilliseconds: number;
}

/**
 * Retries the provided function until it returns `true` or the timeout is reached and displays a notice if the function times out.
 *
 * @param params - The parameters for the function.
 * @returns A {@link Promise} that resolves when the function returns `true` or rejects when the timeout is reached.
 */
export async function retryWithTimeoutNotice(params: RetryWithTimeoutNoticeParams): Promise<void> {
  return retryWithTimeout({
    ...params,
    onTimeout: params.shouldShowTimeoutNotice ?? true
      ? (ctx): void => {
        onTimeoutNotice(ctx, params.pluginNoticeComponent, params.content);
      }
      : onTimeoutWithoutNotice
  });
}

/**
 * Executes a function with a timeout and displays a notice if the function times out.
 *
 * @typeParam Result - The type of the result from the asynchronous function.
 * @param params - The parameters for the function.
 * @returns The result of the function.
 */
export async function runWithTimeoutNotice<Result>(params: RunWithTimeoutNoticeParams<Result>): Promise<Result> {
  return runWithTimeout({
    ...params,
    onTimeout: params.shouldShowTimeoutNotice ?? true
      ? (ctx): void => {
        onTimeoutNotice(ctx, params.pluginNoticeComponent, params.content);
      }
      : onTimeoutWithoutNotice
  });
}

function onTimeoutNotice(ctx: TimeoutContext, pluginNoticeComponent: PluginNoticeComponent, content?: ValueProvider<DocumentFragment | string>): void {
  if (content !== undefined) {
    showCustomContentNotice(ctx, pluginNoticeComponent, content);
    return;
  }

  const startTime = Math.trunc(performance.now() - ctx.duration);
  let runningTimeEl: HTMLSpanElement;
  const SECOND_IN_MILLISECONDS = 1000;
  const cleanup = { intervalId: 0 };

  const notice = pluginNoticeComponent.showNotice(createFragment((f) => {
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
      window.clearInterval(cleanup.intervalId);
      notice.hide();
    });
  }));

  updateRunningTime();
  cleanup.intervalId = window.setInterval(updateRunningTime, SECOND_IN_MILLISECONDS);

  ctx.onOperationCompleted(() => {
    window.clearInterval(cleanup.intervalId);
    notice.hide();
  });

  function updateRunningTime(): void {
    const runningTimeInMilliseconds = Math.max(ctx.duration, Math.round((performance.now() - startTime) / SECOND_IN_MILLISECONDS) * SECOND_IN_MILLISECONDS);
    runningTimeEl.textContent = String(runningTimeInMilliseconds);
  }
}

function onTimeoutWithoutNotice(ctx: TimeoutContext): void {
  const startTime = Math.trunc(performance.now() - ctx.duration);

  ctx.onOperationCompleted(() => {
    getDebugger('AsyncWithNotice:onTimeoutWithoutNotice')('Operation completed after timeout', {
      operationName: ctx.operationName,
      totalDuration: Math.trunc(performance.now() - startTime)
    });
  });
}

function showCustomContentNotice(ctx: TimeoutContext, pluginNoticeComponent: PluginNoticeComponent, content: ValueProvider<DocumentFragment | string>): void {
  let isOperationCompleted = false;
  let notice: Notice | null = null;

  ctx.onOperationCompleted(() => {
    isOperationCompleted = true;
    notice?.hide();
  });

  invokeAsyncSafely(async () => {
    const resolvedContent = await resolveValue(content, {});
    // The operation may have completed while the content was resolving; if so, do not show a stale notice.
    if (isOperationCompleted) {
      return;
    }
    notice = pluginNoticeComponent.showNotice(resolvedContent, { isPermanent: true });
  });
}
