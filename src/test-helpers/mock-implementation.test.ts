import {
  describe,
  expect,
  it
} from 'vitest';

import { mockImplementation } from './mock-implementation.ts';

interface Target {
  // Optional method — its type is `((x: number) => number) | undefined`, mirroring how
  // `obsidian-typings` declares the constructor pseudo-methods (`constructor2__?`, etc.).
  optionalMethod?(x: number): number;
  requiredMethod(x: number): number;
}

describe('mockImplementation', () => {
  it('should spy on a required method and expose the original implementation', () => {
    const obj: Target = {
      requiredMethod(x: number): number {
        return x;
      }
    };

    const spy = mockImplementation({
      impl(this: Target, originalImplementation, x): number {
        return originalImplementation.call(this, x) + 1;
      },
      method: 'requiredMethod',
      obj
    });

    expect(obj.requiredMethod(3)).toBe(4);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('should spy on an optional method whose type is `Fn | undefined`', () => {
    const obj: Target = {
      optionalMethod(x: number): number {
        return x * 2;
      },
      requiredMethod(x: number): number {
        return x;
      }
    };

    // `method: 'optionalMethod'` must type-check. Before the `NonNullable<T[K]>` fix this raised TS2322
    // (`Fn | undefined` does not extend `GenericFunction`), which dropped the optional method key.
    const spy = mockImplementation({
      impl(this: Target, originalImplementation, x): number {
        return originalImplementation.call(this, x) + 1;
      },
      method: 'optionalMethod',
      obj
    });

    expect(obj.optionalMethod?.(3)).toBe(7);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
