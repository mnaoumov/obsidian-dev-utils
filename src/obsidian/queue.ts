/**
 * @file
 *
 * Contains utility functions for enqueuing and processing functions in Obsidian.
 */

import type { Promisable } from 'type-fest';

import type { ValueWrapper } from '../value-wrapper.ts';
import type { PluginNoticeComponent } from './components/plugin-notice-component.ts';

import {
  abortSignalAny,
  abortSignalNever
} from '../abort-controller.ts';
import {
  addErrorHandler,
  invokeAsyncSafely
} from '../async.ts';
import { getStackTrace } from '../error.ts';
import {
  noop,
  noopAsync
} from '../function.ts';
import { getObsidianDevUtilsState } from '../obsidian-dev-utils-state.ts';
import { strictProxy } from '../strict-proxy.ts';
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
   * The function to add.
   */
  operationFn(this: void, abortSignal: AbortSignal): Promisable<void>;

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
   * The function to add.
   */
  operationFn(this: void, abortSignal: AbortSignal): Promisable<void>;

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
  const queue = getQueue().value;
  queue.items.push({
    abortSignal,
    operationFn: params.operationFn,
    operationName,
    shouldShowTimeoutNotice: params.shouldShowTimeoutNotice ?? true,
    stackTrace,
    timeoutInMilliseconds
  });
  queue.promise = queue.promise.then(() => processNextQueueItem());
  await queue.promise;
}

/**
 * Flushes the queue;
 */
export async function flushQueue(): Promise<void> {
  await addToQueueAndWait({
    operationFn: noop,
    operationName: t(($) => $.obsidianDevUtils.queue.flushQueue)
  });
}

function getQueue(): ValueWrapper<Queue> {
  return getObsidianDevUtilsState('queue', { items: [], promise: noopAsync() });
}

async function processNextQueueItem(): Promise<void> {
  const queue = getQueue().value;
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
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
      shouldShowTimeoutNotice: item.shouldShowTimeoutNotice,
      stackTrace: item.stackTrace,
      timeoutInMilliseconds: item.timeoutInMilliseconds
    })
  );
  queue.items.shift();
}
