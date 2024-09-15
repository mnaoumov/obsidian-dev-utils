import { getStackTrace } from '../Error.ts';

/**
 * Invokes a function and logs the start, end, and duration of the invocation.
 *
 * @param title - The title of the log.
 * @param fn - The function to invoke.
 * @param stackTrace - Optional stack trace.
 */
export function invokeAndLog(title: string, fn: () => void, stackTrace?: string): void {
  void invokeAsyncAndLog(title, async () => { fn(); }, stackTrace);
}

/**
 * Invokes an asynchronous function and logs the start, end, and duration of the invocation.
 *
 * @param title - The title of the log.
 * @param fn - The asynchronous function to invoke.
 * @param stackTrace - Optional stack trace.
 */
export async function invokeAsyncAndLog(title: string, fn: () => Promise<void>, stackTrace?: string): Promise<void> {
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
