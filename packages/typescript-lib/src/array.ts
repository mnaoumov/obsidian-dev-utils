/**
 * @file
 *
 * Array utilities.
 */

/**
 * Filter an array in place.
 *
 * @typeParam T - The type of the array elements.
 * @param array - The array to filter.
 * @param shouldKeep - The predicate to filter the array.
 */
export function filterInPlace<T>(array: T[], shouldKeep: (value: T, index: number, array: T[]) => boolean): void {
  const length = array.length;
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < length; readIndex++) {
    if (!Object.hasOwn(array, readIndex)) {
      continue;
    }

    const current = array[readIndex] as T;
    if (shouldKeep(current, readIndex, array)) {
      array[writeIndex++] = current;
    }
  }
  array.length = writeIndex;
}

/**
 * Copies an iterable into a new array, so it can be safely iterated while the original is modified.
 *
 * Use this whenever the loop body (or an awaited call inside it) adds to or removes from the collection
 * being iterated — releasing locks, cancelling timers, settling pending operations. Iterating the live
 * collection in those cases silently skips entries.
 *
 * Prefer this over an inline `[...collection]`: it says why the copy exists, and it keeps the call site
 * clear of `unicorn/no-useless-spread`, which cannot tell a defensive copy from a redundant one.
 *
 * The result is `readonly`: it exists to be iterated, not worked on. Mutating it would change a throwaway
 * copy and leave the original untouched, which is never what the caller wants.
 *
 * @typeParam T - The type of the elements.
 * @param collection - The collection to copy.
 * @returns A new array holding the collection's elements at the time of the call.
 */
export function snapshot<T>(collection: Iterable<T>): readonly T[] {
  return [...collection];
}

/**
 * Remove duplicates from an array.
 *
 * @typeParam T - The type of the array elements.
 * @param array - The array to remove duplicates from.
 * @returns The array with duplicates removed.
 */
export function unique<T>(array: readonly T[]): T[] {
  const set = new Set<T>();
  return array.filter((value) => {
    if (set.has(value)) {
      return false;
    }
    set.add(value);
    return true;
  });
}

/**
 * Remove duplicates from an array in place.
 *
 * @param array - The array to remove duplicates from.
 */
export function uniqueInPlace(array: unknown[]): void {
  const set = new Set<unknown>();
  filterInPlace(array, (value) => {
    if (set.has(value)) {
      return false;
    }
    set.add(value);
    return true;
  });
}
