import type { MaybeReturn } from '../../src/Type.ts';

export function each(
  object: Record<string, unknown>,
  callback: (value: unknown, key?: string) => MaybeReturn<boolean>,
  context?: unknown
): boolean {
  for (const [key, value] of Object.entries(object)) {
    const result = callback.call(context, value, key);
    if (result === false) {
      return false;
    }
  }
  return true;
}

export function isEmpty(object: Record<string, unknown>): boolean {
  return Object.keys(object).length === 0;
}
