/**
 * @file
 *
 * Contains utility functions for enqueuing and processing functions in Obsidian.
 */

import type { App } from 'obsidian';
import type { Promisable } from 'type-fest';

import type { ValueWrapper } from './app.ts';

import {
  abortSignalAny,
  abortSignalNever
} from '../abort-controller.ts';
import {
  addErrorHandler,
  invokeAsyncSafely
} from '../async.ts';
import { getStackTrace } from '../error.ts';
import { noop } from '../function.ts';
import { getObsidianDevUtilsState } from './app.ts';
import { runWithTimeoutNotice } from './async-with-notice.ts';
import { t } from './i18n/i18n.ts';
import { invokeAsyncAndLog } from './logger.ts';

/**
 * Options for the {@link addToQueueAndWait} function.
 */
export interface AddToQueueAndWaitParams {
  /**
   * Optional abort signal.
   */
  readonly abortSignal?: AbortSignal;

  /**
   * The Obsidian application instance.
   */
  readonly app: App;

  /**
   * The function to add.
   */
  readonly operationFn: (abortSignal: AbortSignal) => Promisable<void>;

  /**
   * Optional name of the operation.
   */
  readonly operationName?: string;

  /**
   * Whether to show a timeout notice. Default is `true`.
   */
  readonly shouldShowTimeoutNotice?: boolean;

  /**
   * Optional stack trace.
   */
  readonly stackTrace?: string;

  /**
   * The timeout in milliseconds.
   */
  readonly timeoutInMilliseconds?: number;
}

/**
 * Options for the {@link addToQueue} function.
 */
export interface AddToQueueParams {
  /**
   * Optional abort signal.
   */
  readonly abortSignal?: AbortSignal;

  /**
   * The Obsidian application instance.
   */
  readonly app: App;

  /**
   * The function to add.
   */
  readonly operationFn: (abortSignal: AbortSignal) => Promisable<void>;

  /**
   * Optional name of the operation.
   */
  readonly operationName?: string;

  /**
   * Whether to show a timeout notice. Default is `true`.
   */
  readonly shouldShowTimeoutNotice?: boolean;

  /**
   * Optional stack trace.
   */
  readonly stackTrace?: string;

  /**
   * The timeout in milliseconds.
   */
  readonly timeoutInMilliseconds?: number;
}

interface Queue {
  items: QueueItem[];
  promise: Promise<void>;
}

interface QueueItem {
  abortSignal: AbortSignal;
  operationFn(this: void, abortSignal: AbortSignal): Promisable<void>;
  operationName: string;
  shouldShowTimeoutNotice: boolean;
  stackTrace: string;
  timeoutInMilliseconds: number;
}

/**
 * Adds an asynchronous function to be executed after the previous function completes.
 *
 * @param params - The parameters for the function.
 */
export function addToQueue(params: AddToQueueParams): void {
  const stackTrace = params.stackTrace ?? getStackTrace(1);
  invokeAsyncSafely(() => addToQueueAndWait(params), stackTrace);
}

/**
 * Adds an asynchronous function to be executed after the previous function completes and returns a {@link Promise} that resolves when the function completes.
 *
 * @param params - The parameters for the function.
 */
export async function addToQueueAndWait(params: AddToQueueAndWaitParams): Promise<void> {
  const abortSignal = params.abortSignal ?? abortSignalNever();
  abortSignal.throwIfAborted();

  const DEFAULT_TIMEOUT_IN_MILLISECONDS = 60000;
  const timeoutInMilliseconds = params.timeoutInMilliseconds ?? DEFAULT_TIMEOUT_IN_MILLISECONDS;
  const stackTrace = params.stackTrace ?? getStackTrace(1);
  const operationName = params.operationName ?? '';
  const queue = getQueue(params.app).value;
  queue.items.push({
    abortSignal,
    operationFn: params.operationFn,
    operationName,
    shouldShowTimeoutNotice: params.shouldShowTimeoutNotice ?? true,
    stackTrace,
    timeoutInMilliseconds
  });
  queue.promise = queue.promise.then(() => processNextQueueItem(params.app));
  await queue.promise;
}

/**
 * Flushes the queue;
 *
 * @param app - The Obsidian application instance.
 */
export async function flushQueue(app: App): Promise<void> {
  await addToQueueAndWait({
    app,
    operationFn: noop,
    operationName: t(($) => $.obsidianDevUtils.queue.flushQueue)
  });
}

function getQueue(app: App): ValueWrapper<Queue> {
  return getObsidianDevUtilsState(app, 'queue', { items: [], promise: Promise.resolve() });
}

async function processNextQueueItem(app: App): Promise<void> {
  const queue = getQueue(app).value;
  const item = queue.items[0];
  /* v8 ignore start -- Defensive check; processNextQueueItem is only called after an item is pushed. */
  if (!item) {
    return;
  }
  /* v8 ignore stop */

  await addErrorHandler(() =>
    runWithTimeoutNotice({
      context: { queuedFn: item.operationFn },
      async operationFn(abortSignal: AbortSignal): Promise<void> {
        await invokeAsyncAndLog(
          item.operationName || processNextQueueItem.name,
          item.operationFn,
          abortSignalAny(abortSignal, item.abortSignal),
          item.stackTrace
        );
      },
      operationName: item.operationName,
      shouldShowTimeoutNotice: item.shouldShowTimeoutNotice,
      stackTrace: item.stackTrace,
      timeoutInMilliseconds: item.timeoutInMilliseconds
    })
  );
  queue.items.shift();
}
