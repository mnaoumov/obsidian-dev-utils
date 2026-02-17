import type { Debouncer } from 'obsidian';

import type { MaybeReturn } from '../../src/Type.ts';

import { noop } from '../../src/Function.ts';

export function debounce<T extends unknown[], V>(cb: (...args: [...T]) => V, _timeout?: number, _resetTimer?: boolean): Debouncer<T, V> {
  function debouncer(...args: [...T]): Debouncer<T, V> {
    cb(...args);
    return debouncer as Debouncer<T, V>;
  }
  debouncer.cancel = (): Debouncer<T, V> => debouncer as Debouncer<T, V>;
  debouncer.run = (): MaybeReturn<V> => {
    noop();
  };
  return debouncer as Debouncer<T, V>;
}
