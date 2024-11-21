/**
 * @packageDocumentation Queue
 * Contains utility functions for enqueuing and processing functions in Obsidian.
 */

import type { App } from 'obsidian';

import type { MaybePromise } from '../Async.ts';
import type { ValueWrapper } from './App.ts';

import {
  addErrorHandler,
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
  fn(): MaybePromise<void>;
  stackTrace: string;
  timeoutInMilliseconds: number;
}

function getQueue(app: App): ValueWrapper<Queue> {
  return getObsidianDevUtilsState(app, 'queue', { items: [], promise: Promise.resolve() });
}

/**
 * Adds an asynchronous function to be executed after the previous function completes.
 *
 * @param app - The Obsidian application instance.
 * @param fn - The function to add.
 * @param timeoutInMilliseconds - The timeout in milliseconds.
 */
export function addToQueue(app: App, fn: () => MaybePromise<void>, timeoutInMilliseconds?: number): void {
  void addToQueueAndWait(app, fn, timeoutInMilliseconds);
}

/**
 * Adds an asynchronous function to be executed after the previous function completes and returns a promise that resolves when the function completes.
 *
 * @param app - The Obsidian application instance.
 * @param fn - The function to add.
 * @param timeoutInMilliseconds - The timeout in milliseconds.
 */
export async function addToQueueAndWait(app: App, fn: () => MaybePromise<void>, timeoutInMilliseconds?: number): Promise<void> {
  const DEFAULT_TIMEOUT_IN_MILLISECONDS = 60000;
  timeoutInMilliseconds ??= DEFAULT_TIMEOUT_IN_MILLISECONDS;
  const stackTrace = getStackTrace();
  const queue = getQueue(app).value;
  queue.items.push({ fn, stackTrace, timeoutInMilliseconds });
  queue.promise = queue.promise.then(() => processNextQueueItem(app));
  await queue.promise;
}

async function processNextQueueItem(app: App): Promise<void> {
  const queue = getQueue(app).value;
  const item = queue.items[0];
  if (!item) {
    return;
  }

  await addErrorHandler(() => runWithTimeout(item.timeoutInMilliseconds, () => invokeAsyncAndLog(processNextQueueItem.name, () => item.fn(), item.stackTrace)));
  queue.items.shift();
}

/**
 * Flushes the queue;
 *
 * @param app - The Obsidian application instance.
 */
export async function flushQueue(app: App): Promise<void> {
  await addToQueueAndWait(app, noop);
}
