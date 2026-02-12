import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { resolveValue } from '../src/ValueProvider.ts';

describe('resolveValue', () => {
  describe('direct value provider', () => {
    it.each([
      ['string', 'hello', 'hello'],
      ['number', 42, 42],
      ['null', null, null],
      ['undefined', undefined, undefined]
    ])('should return a %s value', async (_label, input, expected) => {
      const result = await resolveValue(input);
      expect(result).toBe(expected);
    });

    it('should return an object value by reference', async () => {
      const obj = { key: 'value' };
      const result = await resolveValue(obj);
      expect(result).toBe(obj);
    });
  });

  describe('sync function provider', () => {
    it('should return the result of the sync function', async () => {
      const provider = vi.fn((): string => 'result');
      const result = await resolveValue(provider);
      expect(result).toBe('result');
    });

    it('should call the sync function exactly once', async () => {
      const provider = vi.fn((): string => 'result');
      await resolveValue(provider);
      expect(provider).toHaveBeenCalledOnce();
    });

    it('should pass the abort signal to the function', async () => {
      const provider = vi.fn((_signal: AbortSignal): string => 'ok');
      const controller = new AbortController();
      await resolveValue(provider, controller.signal);
      expect(provider).toHaveBeenCalledWith(controller.signal);
    });

    it('should return the correct result when an abort signal is provided', async () => {
      const provider = vi.fn((_signal: AbortSignal): string => 'ok');
      const controller = new AbortController();
      const result = await resolveValue(provider, controller.signal);
      expect(result).toBe('ok');
    });
  });

  describe('async function provider', () => {
    it('should return the resolved value of the async function', async () => {
      const provider = vi.fn(async (): Promise<string> => {
        return 'async-result';
      });
      const result = await resolveValue(provider);
      expect(result).toBe('async-result');
    });

    it('should call the async function exactly once', async () => {
      const provider = vi.fn(async (): Promise<string> => {
        return 'async-result';
      });
      await resolveValue(provider);
      expect(provider).toHaveBeenCalledOnce();
    });
  });

  describe('arguments passing', () => {
    it('should return the correct result from extra arguments', async () => {
      const provider = vi.fn((_signal: AbortSignal, a: number, b: string): string => {
        return `${String(a)}-${b}`;
      });
      const result = await resolveValue(provider, undefined, 42, 'hello');
      expect(result).toBe('42-hello');
    });

    it('should call the function exactly once with extra arguments', async () => {
      const provider = vi.fn((_signal: AbortSignal, a: number, b: string): string => {
        return `${String(a)}-${b}`;
      });
      await resolveValue(provider, undefined, 42, 'hello');
      expect(provider).toHaveBeenCalledOnce();
    });

    it('should pass the first extra argument correctly', async () => {
      const provider = vi.fn((_signal: AbortSignal, a: number, b: string): string => {
        return `${String(a)}-${b}`;
      });
      await resolveValue(provider, undefined, 42, 'hello');
      const call = provider.mock.calls[0]!;
      expect(call[1]).toBe(42);
    });

    it('should pass the second extra argument correctly', async () => {
      const provider = vi.fn((_signal: AbortSignal, a: number, b: string): string => {
        return `${String(a)}-${b}`;
      });
      await resolveValue(provider, undefined, 42, 'hello');
      const call = provider.mock.calls[0]!;
      expect(call[2]).toBe('hello');
    });
  });

  describe('abort signal behavior', () => {
    it('should use abortSignalNever when no signal is provided (does not throw)', async () => {
      const provider = vi.fn((_signal: AbortSignal): string => 'ok');
      const result = await resolveValue(provider);
      expect(result).toBe('ok');
    });

    it('should throw when an already-aborted signal is provided', async () => {
      const controller = new AbortController();
      controller.abort(new Error('aborted'));

      await expect(resolveValue('value', controller.signal)).rejects.toThrow();
    });

    it('should throw for an already-aborted signal even with a function provider', async () => {
      const controller = new AbortController();
      controller.abort(new Error('aborted'));
      const provider = vi.fn((): string => 'should not reach');

      await expect(resolveValue(provider, controller.signal)).rejects.toThrow();
    });

    it('should not call the function provider when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort(new Error('aborted'));
      const provider = vi.fn((): string => 'should not reach');

      try {
        await resolveValue(provider, controller.signal);
      } catch {
        // expected
      }
      expect(provider).not.toHaveBeenCalled();
    });

    it('should not throw when a non-aborted signal is provided', async () => {
      const controller = new AbortController();
      const result = await resolveValue('value', controller.signal);
      expect(result).toBe('value');
    });
  });
});
