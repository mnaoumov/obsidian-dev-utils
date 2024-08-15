import type { MaybePromise } from "./Async.ts";

export type ValueProvider<R, Args extends unknown[] = []> = R | ((...args: Args) => MaybePromise<R>);

function isFunction<R, Args extends unknown[]>(value: ValueProvider<R, Args>): value is (...args: Args) => MaybePromise<R> {
  return typeof value === "function";
}

export async function resolveValue<Args extends unknown[], R>(processor: ValueProvider<R, Args>, ...args: Args): Promise<R> {
  if (isFunction(processor)) {
    return await processor(...args);
  } else {
    return processor;
  }
}
