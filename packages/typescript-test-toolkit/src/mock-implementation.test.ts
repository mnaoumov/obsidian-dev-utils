import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { mockImplementation } from './mock-implementation.ts';

interface Target {
  // Optional method — its type is `((x: number) => number) | undefined`, mirroring how
  // `obsidian-typings` declares the constructor pseudo-methods (`constructor2__?`, etc.).
  optionalMethod?: (x: number) => number;
  requiredMethod: (x: number) => number;
}

describe('mockImplementation', () => {
  it('should spy on a required method and expose the original implementation', () => {
    const $object: Target = {
      requiredMethod(x: number): number {
        return x;
      }
    };

    const spy = mockImplementation({
      $object,
      impl(this: Target, originalImplementation, x): number {
        return originalImplementation.call(this, x) + 1;
      },
      method: 'requiredMethod'
    });

    expect($object.requiredMethod(3)).toBe(4);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('should spy on an optional method whose type is `Fn | undefined`', () => {
    const $object: Target = {
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
      $object,
      impl(this: Target, originalImplementation, x): number {
        return originalImplementation.call(this, x) + 1;
      },
      method: 'optionalMethod'
    });

    expect($object.optionalMethod?.(3)).toBe(7);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('should keep handing out the first original when the same method is spied on again', () => {
    const $object: Target = {
      requiredMethod(x: number): number {
        return x;
      }
    };

    mockImplementation({
      $object,
      impl(this: Target, originalImplementation, x): number {
        return originalImplementation.call(this, x) + 1;
      },
      method: 'requiredMethod'
    });
    const spy = mockImplementation({
      $object,
      impl(this: Target, originalImplementation, x): number {
        return originalImplementation.call(this, x) + 10;
      },
      method: 'requiredMethod'
    });

    expect($object.requiredMethod(3)).toBe(13);
    spy.mockRestore();
  });

  it('should not record a mock function as the original', () => {
    const $object: Target = {
      requiredMethod: vi.fn((x: number) => x)
    };

    let receivedOriginal: unknown = 'not called';
    const spy = mockImplementation({
      $object,
      impl(this: Target, originalImplementation): number {
        receivedOriginal = originalImplementation;
        return 0;
      },
      method: 'requiredMethod'
    });

    $object.requiredMethod(3);
    expect(receivedOriginal).toBeUndefined();
    spy.mockRestore();
  });
});
