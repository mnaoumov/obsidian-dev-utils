import type { MaybePromise } from '../Async.ts';
import { getStackTrace } from '../Error.ts';

/**
 * Invokes a function and logs the start, end, and duration of the invocation.
 *
 * @param title - The title of the log.
 * @param fn - The function to invoke.
 * @param stackTrace - Optional stack trace.
 */
export async function invokeAsyncAndLog(title: string, fn: () => MaybePromise<void>, stackTrace?: string): Promise<void> {
  const timestampStart = Date.now();
  if (stackTrace === undefined) {
    stackTrace = getStackTrace().split('\n').slice(1).join('\n');
  }
  console.debug(`${title}:start`, {
    timestampStart,
    fn,
    stackTrace
  });
  try {
    await fn();
    const timestampEnd = Date.now();
    console.debug(`${title}:end`, {
      timestampStart,
      timestampEnd,
      duration: timestampEnd - timestampStart
    });
  } catch (error) {
    const timestampEnd = Date.now();
    console.debug(`${title}:error`, {
      timestampStart,
      timestampEnd: Date.now(),
      duration: timestampEnd - timestampStart,
      error
    });

    throw error;
  }
}
