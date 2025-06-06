/**
 * @packageDocumentation
 *
 * Contains utility functions for enqueuing and processing functions in Obsidian.
 */

import type { App } from 'obsidian';
import type { Promisable } from 'type-fest';

import type { ValueWrapper } from './App.ts';

import {
  addErrorHandler,
  invokeAsyncSafely,
  runWithTimeout
} from '../Async.ts';
import { getStackTrace } from '../Error.ts';
import { noop } from '../Function.ts';
import { getObsidianDevUtilsState } from './App.ts';
import { invokeAsyncAndLog } from './Logger.ts';

interface Queue {
  items: QueueItem[];
  promise: Promise<void>;
}

interface QueueItem {
  fn(this: void): Promisable<void>;
  stackTrace: string;
  timeoutInMilliseconds: number;
}

/**
 * Adds an asynchronous function to be executed after the previous function completes.
 *
 * @param app - The Obsidian application instance.
 * @param fn - The function to add.
 * @param timeoutInMilliseconds - The timeout in milliseconds.
 * @param stackTrace - Optional stack trace.
 */
export function addToQueue(app: App, fn: () => Promisable<void>, timeoutInMilliseconds?: number, stackTrace?: string): void {
  stackTrace ??= getStackTrace(1);
  invokeAsyncSafely(() => addToQueueAndWait(app, fn, timeoutInMilliseconds, stackTrace));
}

/**
 * Adds an asynchronous function to be executed after the previous function completes and returns a {@link Promise} that resolves when the function completes.
 *
 * @param app - The Obsidian application instance.
 * @param fn - The function to add.
 * @param timeoutInMilliseconds - The timeout in milliseconds.
 * @param stackTrace - Optional stack trace.
 */
export async function addToQueueAndWait(app: App, fn: () => Promisable<void>, timeoutInMilliseconds?: number, stackTrace?: string): Promise<void> {
  const DEFAULT_TIMEOUT_IN_MILLISECONDS = 60000;
  timeoutInMilliseconds ??= DEFAULT_TIMEOUT_IN_MILLISECONDS;
  stackTrace ??= getStackTrace(1);
  const queue = getQueue(app).value;
  queue.items.push({ fn, stackTrace, timeoutInMilliseconds });
  queue.promise = queue.promise.then(() => processNextQueueItem(app));
  await queue.promise;
}

/**
 * Flushes the queue;
 *
 * @param app - The Obsidian application instance.
 */
export async function flushQueue(app: App): Promise<void> {
  await addToQueueAndWait(app, noop);
}

function getQueue(app: App): ValueWrapper<Queue> {
  return getObsidianDevUtilsState(app, 'queue', { items: [], promise: Promise.resolve() });
}

async function processNextQueueItem(app: App): Promise<void> {
  const queue = getQueue(app).value;
  const item = queue.items[0];
  if (!item) {
    return;
  }

  await addErrorHandler(() =>
    runWithTimeout(item.timeoutInMilliseconds, () => invokeAsyncAndLog(processNextQueueItem.name, item.fn, item.stackTrace), { queuedFn: item.fn })
  );
  queue.items.shift();
}
