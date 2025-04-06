/**
 * Filter an array in place.
 *
 * @param arr - The array to filter.
 * @param predicate - The predicate to filter the array.
 */
export function filterInPlace<T>(arr: T[], predicate: (value: T, index: number, array: T[]) => boolean): void {
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < arr.length; readIndex++) {
    if (!(readIndex in arr)) {
      continue;
    }

    const current = arr[readIndex] as T;
    if (predicate(current, readIndex, arr)) {
      arr[writeIndex++] = current;
    }
  }
  arr.length = writeIndex;
}
