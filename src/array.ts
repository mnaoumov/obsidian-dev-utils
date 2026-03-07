/**
 * @packageDocumentation
 *
 * Array utilities.
 */

/**
 * Filter an array in place.
 *
 * @param arr - The array to filter.
 * @param predicate - The predicate to filter the array.
 */
export function filterInPlace<T>(arr: T[], predicate: (value: T, index: number, array: T[]) => boolean): void {
  const length = arr.length;
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < length; readIndex++) {
    if (!Object.hasOwn(arr, readIndex)) {
      continue;
    }

    const current = arr[readIndex] as T;
    if (predicate(current, readIndex, arr)) {
      arr[writeIndex++] = current;
    }
  }
  arr.length = writeIndex;
}

/**
 * Remove duplicates from an array.
 *
 * @param arr - The array to remove duplicates from.
 * @returns The array with duplicates removed.
 */
export function unique<T>(arr: readonly T[]): T[] {
  const set = new Set<T>();
  return arr.filter((value) => {
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
 * @param arr - The array to remove duplicates from.
 */
export function uniqueInPlace(arr: unknown[]): void {
  const set = new Set<unknown>();
  filterInPlace(arr, (value) => {
    if (set.has(value)) {
      return false;
    }
    set.add(value);
    return true;
  });
}
