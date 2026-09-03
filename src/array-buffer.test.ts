import {
  describe,
  expect,
  it
} from 'vitest';

import { toArrayBuffer } from './array-buffer.ts';

describe('toArrayBuffer', () => {
  it('should hold exactly the input bytes', () => {
    const data = new Uint8Array([
      1,
      2,
      3
    ]);
    const buffer = toArrayBuffer(data);
    expect(buffer.byteLength).toBe(3);
    expect([...new Uint8Array(buffer)]).toEqual([
      1,
      2,
      3
    ]);
  });

  it('should copy, so a later mutation of the source does not reach it', () => {
    const data = new Uint8Array([
      1,
      2,
      3
    ]);
    const buffer = toArrayBuffer(data);
    data[0] = 42;
    expect([...new Uint8Array(buffer)]).toEqual([
      1,
      2,
      3
    ]);
  });

  // The whole reason the function exists: `data.buffer` on a partial view is the WHOLE backing buffer.
  it('should take only the view\'s bytes when the source covers part of a larger buffer', () => {
    const backing = new Uint8Array([
      1,
      2,
      3,
      4,
      5
    ]);
    const view = backing.subarray(1, 4);
    const buffer = toArrayBuffer(view);
    expect(buffer.byteLength).toBe(3);
    expect([...new Uint8Array(buffer)]).toEqual([
      2,
      3,
      4
    ]);
  });
});
