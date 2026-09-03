/**
 * @file
 *
 * Contains utility functions for byte counts.
 */

const BYTES_PER_UNIT = 1024;
const DECIMALS = 1;
const UNITS = [
  'B',
  'KB',
  'MB',
  'GB',
  'TB'
] as const;

/**
 * Renders a byte count the way a file manager does, so a running total answers "is this getting huge?" at
 * a glance.
 *
 * Past the largest unit the number keeps growing rather than starting over, because under-reporting a size
 * by a factor of 1024 is worse than an ungainly number.
 *
 * @param bytes - The number of bytes.
 * @returns The formatted size, e.g. `1.4 MB`.
 */
export function formatBytes(bytes: number): string {
  let size = bytes;
  let unit: string = UNITS[0];
  let isInBytes = true;

  for (const largerUnit of UNITS.slice(1)) {
    if (size < BYTES_PER_UNIT) {
      break;
    }

    size /= BYTES_PER_UNIT;
    unit = largerUnit;
    isInBytes = false;
  }

  // Whole bytes never want a decimal point: `817 B`, not `817.0 B`.
  return `${isInBytes ? String(size) : size.toFixed(DECIMALS)} ${unit}`;
}
