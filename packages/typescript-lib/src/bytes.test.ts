import {
  describe,
  expect,
  it
} from 'vitest';

import { formatBytes } from './bytes.ts';

describe('formatBytes', () => {
  it('should report whole bytes without a decimal point', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(817)).toBe('817 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('should step up a unit at a time', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
    expect(formatBytes(1024 ** 4)).toBe('1.0 TB');
  });

  /*
   * Past the largest unit the number keeps growing rather than silently resetting - a size that big is
   * absurd, but under-reporting it by a factor of 1024 would be worse than an ungainly number.
   */
  it('should keep counting in the largest unit it has', () => {
    expect(formatBytes(1024 ** 5)).toBe('1024.0 TB');
  });
});
