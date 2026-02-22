/**
 * @packageDocumentation
 *
 * Contains utility functions for enqueuing and processing functions in Obsidian.
 */

import type { App } from 'obsidian';
import type { Promisable } from 'type-fest';

import type { ValueWrapper } from './App.ts';

import {
  abortSignalAny,
  abortSignalNever
} from '../AbortController.ts';
import {
  addErrorHandler,
  invokeAsyncSafely
} from '../Async.ts';
import { getStackTrace } from '../Error.ts';
import { noop } from '../Function.ts';
import { getObsidianDevUtilsState } from './App.ts';
import { runWithTimeoutNotice } from './AsyncWithNotice.ts';
import { t } from './i18n/i18n.ts';
import { invokeAsyncAndLog } from './Logger.ts';

/**
 * Options for the {@link addToQueueAndWait} function.
 */
export interface AddToQueueAndWaitOptions {
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
export interface AddToQueueOptions {
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
 * @param options - The options for the function.
 */
export function addToQueue(options: AddToQueueOptions): void {
  const stackTrace = options.stackTrace ?? getStackTrace(1);
  invokeAsyncSafely(() => addToQueueAndWait(options), stackTrace);
}

/**
 * Adds an asynchronous function to be executed after the previous function completes and returns a {@link Promise} that resolves when the function completes.
 *
 * @param options - The options for the function.
 */
export async function addToQueueAndWait(options: AddToQueueAndWaitOptions): Promise<void> {
  const abortSignal = options.abortSignal ?? abortSignalNever();
  abortSignal.throwIfAborted();

  const DEFAULT_TIMEOUT_IN_MILLISECONDS = 60000;
  const timeoutInMilliseconds = options.timeoutInMilliseconds ?? DEFAULT_TIMEOUT_IN_MILLISECONDS;
  const stackTrace = options.stackTrace ?? getStackTrace(1);
  const operationName = options.operationName ?? '';
  const queue = getQueue(options.app).value;
  queue.items.push({
    abortSignal,
    operationFn: options.operationFn,
    operationName,
    shouldShowTimeoutNotice: options.shouldShowTimeoutNotice ?? true,
    stackTrace,
    timeoutInMilliseconds
  });
  queue.promise = queue.promise.then(() => processNextQueueItem(options.app));
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
