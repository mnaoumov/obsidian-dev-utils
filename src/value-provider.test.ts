import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { assertNonNullable } from './type-guards.ts';
import { resolveValue } from './value-provider.ts';

interface Args {
  readonly a: number;
  readonly b: string;
}

describe('resolveValue', () => {
  describe('direct value provider', () => {
    it.each([
      ['string', 'hello', 'hello'],
      ['number', 42, 42],
      ['null', null, null],
      ['undefined', undefined, undefined]
    ])('should return a %s value', async (_label, input, expected) => {
      const result = await resolveValue(input, {});
      expect(result).toBe(expected);
    });

    it('should return an object value by reference', async () => {
      const obj = { key: 'value' };
      const result = await resolveValue(obj, {});
      expect(result).toBe(obj);
    });
  });

  describe('sync function provider', () => {
    it('should return the result of the sync function', async () => {
      const provider = vi.fn((): string => 'result');
      const result = await resolveValue(provider, {});
      expect(result).toBe('result');
    });

    it('should call the sync function exactly once', async () => {
      const provider = vi.fn((): string => 'result');
      await resolveValue(provider, {});
      expect(provider).toHaveBeenCalledOnce();
    });

    it('should pass the abort signal to the function', async () => {
      const provider = vi.fn((): string => 'ok');
      const controller = new AbortController();
      await resolveValue(provider, { abortSignal: controller.signal });
      expect(provider).toHaveBeenCalledWith({ abortSignal: controller.signal });
    });

    it('should return the correct result when an abort signal is provided', async () => {
      const provider = vi.fn((): string => 'ok');
      const controller = new AbortController();
      const result = await resolveValue(provider, { abortSignal: controller.signal });
      expect(result).toBe('ok');
    });
  });

  describe('async function provider', () => {
    it('should return the resolved value of the async function', async () => {
      const provider = vi.fn(async (): Promise<string> => {
        return 'async-result';
      });
      const result = await resolveValue(provider, {});
      expect(result).toBe('async-result');
    });

    it('should call the async function exactly once', async () => {
      const provider = vi.fn(async (): Promise<string> => {
        return 'async-result';
      });
      await resolveValue(provider, {});
      expect(provider).toHaveBeenCalledOnce();
    });
  });

  describe('arguments passing', () => {
    it('should return the correct result from extra arguments', async () => {
      const provider = vi.fn(({ a, b }: Args): string => {
        return `${String(a)}-${b}`;
      });
      const result = await resolveValue(provider, { a: 42, b: 'hello' });
      expect(result).toBe('42-hello');
    });

    it('should call the function exactly once with extra arguments', async () => {
      const provider = vi.fn(({ a, b }: Args): string => {
        return `${String(a)}-${b}`;
      });
      await resolveValue(provider, { a: 42, b: 'hello' });
      expect(provider).toHaveBeenCalledOnce();
    });

    it('should pass the first extra argument correctly', async () => {
      const provider = vi.fn(({ a, b }: Args): string => {
        return `${String(a)}-${b}`;
      });
      await resolveValue(provider, { a: 42, b: 'hello' });
      const call = provider.mock.calls[0];
      assertNonNullable(call);
      expect(call[0].a).toBe(42);
    });

    it('should pass the second extra argument correctly', async () => {
      const provider = vi.fn(({ a, b }: Args): string => {
        return `${String(a)}-${b}`;
      });
      await resolveValue(provider, { a: 42, b: 'hello' });
      const call = provider.mock.calls[0];
      assertNonNullable(call);
      expect(call[0].b).toBe('hello');
    });
  });

  describe('abort signal behavior', () => {
    it('should use abortSignalNever when no signal is provided (does not throw)', async () => {
      const provider = vi.fn((): string => 'ok');
      const result = await resolveValue(provider, {});
      expect(result).toBe('ok');
    });

    it('should throw when an already-aborted signal is provided', async () => {
      const controller = new AbortController();
      controller.abort(new Error('aborted'));

      await expect(resolveValue('value', { abortSignal: controller.signal })).rejects.toThrow();
    });

    it('should throw for an already-aborted signal even with a function provider', async () => {
      const controller = new AbortController();
      controller.abort(new Error('aborted'));
      const provider = vi.fn((): string => 'should not reach');

      await expect(resolveValue(provider, { abortSignal: controller.signal })).rejects.toThrow();
    });

    it('should not call the function provider when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort(new Error('aborted'));
      const provider = vi.fn((): string => 'should not reach');

      try {
        await resolveValue(provider, { abortSignal: controller.signal });
      } catch {
        // Expected
      }
      expect(provider).not.toHaveBeenCalled();
    });

    it('should not throw when a non-aborted signal is provided', async () => {
      const controller = new AbortController();
      const result = await resolveValue('value', { abortSignal: controller.signal });
      expect(result).toBe('value');
    });
  });
});
