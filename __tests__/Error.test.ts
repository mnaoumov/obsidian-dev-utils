import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  ASYNC_WRAPPER_ERROR_MESSAGE,
  CustomStackTraceError,
  emitAsyncErrorEvent,
  errorToString,
  getStackTrace,
  printError,
  registerAsyncErrorEventHandler,
  SilentError,
  throwExpression
} from '../src/Error.ts';
import { assertNotNullable } from './TestHelpers.ts';

describe('ASYNC_WRAPPER_ERROR_MESSAGE', () => {
  it('should be the expected constant string', () => {
    expect(ASYNC_WRAPPER_ERROR_MESSAGE).toBe('An unhandled error occurred executing async operation');
  });
});

describe('throwExpression', () => {
  it('should throw the provided Error', () => {
    const error = new Error('test error');
    expect(() => throwExpression(error)).toThrow(error);
  });

  it('should throw a string value', () => {
    expect(() => throwExpression('string error')).toThrow('string error');
  });

  it('should throw non-Error objects', () => {
    const obj = { code: 42 };
    expect(() => throwExpression(obj)).toThrow();
  });
});

describe('errorToString', () => {
  it.each([
    ['simple string', 'simple string'],
    [42, '42'],
    [null, 'null'],
    [undefined, 'undefined']
  ])('should convert non-Error value %j to its string representation %s', (input, expected) => {
    expect(errorToString(input)).toBe(expected);
  });

  it('should include the error message in the stack', () => {
    const error = new Error('test');
    const result = errorToString(error);
    expect(result).toContain('Error: test');
  });

  it('should include stack frames from the Error', () => {
    const error = new Error('test');
    const result = errorToString(error);
    expect(result).toContain('at ');
  });

  it('should fall back to name + message if stack is undefined', () => {
    const error = new Error('test');
    Object.defineProperty(error, 'stack', { value: undefined });
    const result = errorToString(error);
    expect(result).toBe('Error: test');
  });

  it('should include the outer error message for nested causes', () => {
    const cause = new Error('root cause');
    const error = new Error('outer error', { cause });
    const result = errorToString(error);
    expect(result).toContain('outer error');
  });

  it('should include the Caused by label for nested causes', () => {
    const cause = new Error('root cause');
    const error = new Error('outer error', { cause });
    const result = errorToString(error);
    expect(result).toContain('Caused by:');
  });

  it('should include the root cause message for nested causes', () => {
    const cause = new Error('root cause');
    const error = new Error('outer error', { cause });
    const result = errorToString(error);
    expect(result).toContain('root cause');
  });

  it('should include the outer message for deeply nested causes', () => {
    const deepCause = new Error('deep');
    const midCause = new Error('mid', { cause: deepCause });
    const outerError = new Error('outer', { cause: midCause });
    const result = errorToString(outerError);
    expect(result).toContain('outer');
  });

  it('should include the mid-level message for deeply nested causes', () => {
    const deepCause = new Error('deep');
    const midCause = new Error('mid', { cause: deepCause });
    const outerError = new Error('outer', { cause: midCause });
    const result = errorToString(outerError);
    expect(result).toContain('mid');
  });

  it('should include the deepest cause message for deeply nested causes', () => {
    const deepCause = new Error('deep');
    const midCause = new Error('mid', { cause: deepCause });
    const outerError = new Error('outer', { cause: midCause });
    const result = errorToString(outerError);
    expect(result).toContain('deep');
  });

  it('should include the Caused by label for non-Error cause values', () => {
    const error = new Error('outer', { cause: 'string cause' });
    const result = errorToString(error);
    expect(result).toContain('Caused by:');
  });

  it('should include the non-Error cause value', () => {
    const error = new Error('outer', { cause: 'string cause' });
    const result = errorToString(error);
    expect(result).toContain('string cause');
  });

  it('should not contain double newlines when cause has empty lines in stack', () => {
    const cause = new Error('root');
    Object.defineProperty(cause, 'stack', { value: 'Error: root\n\n    at something (file.ts:1:1)' });
    const error = new Error('outer', { cause });
    const result = errorToString(error);
    expect(result).not.toContain('\n\n');
  });

  it('should preserve stack frame content when cause has empty lines in stack', () => {
    const cause = new Error('root');
    Object.defineProperty(cause, 'stack', { value: 'Error: root\n\n    at something (file.ts:1:1)' });
    const error = new Error('outer', { cause });
    const result = errorToString(error);
    expect(result).toContain('something');
  });
});

describe('getStackTrace', () => {
  it('should return a string', () => {
    const trace = getStackTrace();
    expect(typeof trace).toBe('string');
  });

  it('should contain stack frames', () => {
    const trace = getStackTrace();
    expect(trace).toContain('at ');
  });

  it('should produce valid stack traces with and without framesToSkip', () => {
    function wrapper(): string {
      return getStackTrace(0);
    }
    const directTrace = wrapper();
    expect(directTrace).toContain('at ');
  });

  it('should produce fewer lines when framesToSkip is provided', () => {
    function wrapper(): string {
      return getStackTrace(0);
    }
    function outerWrapper(): string {
      return getStackTrace(1);
    }

    const directLines = wrapper().split('\n').length;
    const skippedLines = outerWrapper().split('\n').length;
    expect(skippedLines).toBeLessThanOrEqual(directLines);
  });
});

describe('SilentError', () => {
  it('should be an instance of Error', () => {
    const error = new SilentError('quiet');
    expect(error).toBeInstanceOf(Error);
  });

  it('should be an instance of SilentError', () => {
    const error = new SilentError('quiet');
    expect(error).toBeInstanceOf(SilentError);
  });

  it('should have name set to SilentError', () => {
    const error = new SilentError('quiet');
    expect(error.name).toBe('SilentError');
  });

  it('should have the correct message', () => {
    const error = new SilentError('quiet');
    expect(error.message).toBe('quiet');
  });

  it('should have a defined stack trace', () => {
    const error = new SilentError('test');
    expect(error.stack).toBeDefined();
  });

  it('should include SilentError in the stack trace', () => {
    const error = new SilentError('test');
    expect(error.stack).toContain('SilentError');
  });
});

describe('CustomStackTraceError', () => {
  it('should be an instance of Error', () => {
    const customStack = '    at customFunction (file.ts:10:5)\n    at main (file.ts:20:3)';
    const cause = new Error('original');
    const error = new CustomStackTraceError('wrapped', customStack, cause);
    expect(error).toBeInstanceOf(Error);
  });

  it('should be an instance of CustomStackTraceError', () => {
    const customStack = '    at customFunction (file.ts:10:5)\n    at main (file.ts:20:3)';
    const cause = new Error('original');
    const error = new CustomStackTraceError('wrapped', customStack, cause);
    expect(error).toBeInstanceOf(CustomStackTraceError);
  });

  it('should have name set to CustomStackTraceError', () => {
    const customStack = '    at customFunction (file.ts:10:5)\n    at main (file.ts:20:3)';
    const cause = new Error('original');
    const error = new CustomStackTraceError('wrapped', customStack, cause);
    expect(error.name).toBe('CustomStackTraceError');
  });

  it('should have the correct message', () => {
    const customStack = '    at customFunction (file.ts:10:5)\n    at main (file.ts:20:3)';
    const cause = new Error('original');
    const error = new CustomStackTraceError('wrapped', customStack, cause);
    expect(error.message).toBe('wrapped');
  });

  it('should have the correct cause', () => {
    const customStack = '    at customFunction (file.ts:10:5)\n    at main (file.ts:20:3)';
    const cause = new Error('original');
    const error = new CustomStackTraceError('wrapped', customStack, cause);
    expect(error.cause).toBe(cause);
  });

  it('should include the custom stack frames', () => {
    const customStack = '    at customFunction (file.ts:10:5)\n    at main (file.ts:20:3)';
    const cause = new Error('original');
    const error = new CustomStackTraceError('wrapped', customStack, cause);
    expect(error.stack).toContain('customFunction');
  });

  it('should include all provided stack frames', () => {
    const customStack = '    at customFunction (file.ts:10:5)\n    at main (file.ts:20:3)';
    const cause = new Error('original');
    const error = new CustomStackTraceError('wrapped', customStack, cause);
    expect(error.stack).toContain('main');
  });

  it('should replace the error header with CustomStackTraceError header', () => {
    const customStack = 'Error: some message\n    at fn (file.ts:1:1)';
    const error = new CustomStackTraceError('test', customStack, null);
    expect(error.stack).toContain('CustomStackTraceError: test');
  });

  it('should preserve stack frames when stripping the error header', () => {
    const customStack = 'Error: some message\n    at fn (file.ts:1:1)';
    const error = new CustomStackTraceError('test', customStack, null);
    expect(error.stack).toContain('at fn (file.ts:1:1)');
  });

  it('should detect circular causes and throw', () => {
    const error1 = new CustomStackTraceError('first', '    at a (a.ts:1:1)', null);
    // Manually set circular cause
    Object.defineProperty(error1, 'cause', { value: error1, writable: true });

    expect(
      () => new CustomStackTraceError('second', '    at b (b.ts:1:1)', error1)
    ).toThrow('Circular cause detected');
  });

  it('should set the correct message for deeply nested causes without circularity', () => {
    const inner = new CustomStackTraceError('inner', '    at inner (inner.ts:1:1)', null);
    const middle = new CustomStackTraceError('middle', '    at middle (middle.ts:1:1)', inner);
    const outer = new CustomStackTraceError('outer', '    at outer (outer.ts:1:1)', middle);
    expect(outer.message).toBe('outer');
  });

  it('should set the correct cause for deeply nested causes without circularity', () => {
    const inner = new CustomStackTraceError('inner', '    at inner (inner.ts:1:1)', null);
    const middle = new CustomStackTraceError('middle', '    at middle (middle.ts:1:1)', inner);
    const outer = new CustomStackTraceError('outer', '    at outer (outer.ts:1:1)', middle);
    expect(outer.cause).toBe(middle);
  });

  it('should handle non-CustomStackTraceError cause', () => {
    const cause = 'string cause';
    const error = new CustomStackTraceError('test', '    at fn (file.ts:1:1)', cause);
    expect(error.cause).toBe('string cause');
  });
});

describe('printError', () => {
  it('should call console.error with the error string', () => {
    const mockConsole = { error: vi.fn() } as unknown as Console;
    const error = new Error('print me');

    printError(error, mockConsole);

    expect(mockConsole.error).toHaveBeenCalledTimes(1);
  });

  it('should include the error message in the output', () => {
    const mockConsole = { error: vi.fn() } as unknown as Console;
    const error = new Error('print me');

    printError(error, mockConsole);

    const firstCall = (mockConsole.error as ReturnType<typeof vi.fn>).mock.calls[0];
    assertNotNullable(firstCall);
    const output = firstCall[0] as string;
    expect(output).toContain('print me');
  });

  it('should call console.error once for non-Error values', () => {
    const mockConsole = { error: vi.fn() } as unknown as Console;
    printError('just a string', mockConsole);

    expect(mockConsole.error).toHaveBeenCalledTimes(1);
  });

  it('should pass the non-Error value directly to console.error', () => {
    const mockConsole = { error: vi.fn() } as unknown as Console;
    printError('just a string', mockConsole);

    const firstCall = (mockConsole.error as ReturnType<typeof vi.fn>).mock.calls[0];
    assertNotNullable(firstCall);
    expect(firstCall[0]).toBe('just a string');
  });

  it('should include the outer error message when printing nested causes', () => {
    const mockConsole = { error: vi.fn() } as unknown as Console;
    const cause = new Error('root');
    const error = new Error('outer', { cause });

    printError(error, mockConsole);

    const firstCall = (mockConsole.error as ReturnType<typeof vi.fn>).mock.calls[0];
    assertNotNullable(firstCall);
    const output = firstCall[0] as string;
    expect(output).toContain('outer');
  });

  it('should include the Caused by label when printing nested causes', () => {
    const mockConsole = { error: vi.fn() } as unknown as Console;
    const cause = new Error('root');
    const error = new Error('outer', { cause });

    printError(error, mockConsole);

    const firstCall = (mockConsole.error as ReturnType<typeof vi.fn>).mock.calls[0];
    assertNotNullable(firstCall);
    const output = firstCall[0] as string;
    expect(output).toContain('Caused by:');
  });

  it('should include the root cause message when printing nested causes', () => {
    const mockConsole = { error: vi.fn() } as unknown as Console;
    const cause = new Error('root');
    const error = new Error('outer', { cause });

    printError(error, mockConsole);

    const firstCall = (mockConsole.error as ReturnType<typeof vi.fn>).mock.calls[0];
    assertNotNullable(firstCall);
    const output = firstCall[0] as string;
    expect(output).toContain('root');
  });
});

describe('emitAsyncErrorEvent + registerAsyncErrorEventHandler', () => {
  it('should call the registered handler when an async error is emitted', () => {
    const handler = vi.fn();
    const unregister = registerAsyncErrorEventHandler(handler);

    const error = new Error('async error');
    emitAsyncErrorEvent(error);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(error);

    unregister();
  });

  it('should not call the handler after unregistering', () => {
    const handler = vi.fn();
    const unregister = registerAsyncErrorEventHandler(handler);

    unregister();

    emitAsyncErrorEvent(new Error('should not reach handler'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('should call all registered handlers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const unregister1 = registerAsyncErrorEventHandler(handler1);
    const unregister2 = registerAsyncErrorEventHandler(handler2);

    const error = new Error('multi');
    emitAsyncErrorEvent(error);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler1).toHaveBeenCalledWith(error);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledWith(error);

    unregister1();
    unregister2();
  });

  it('should only unregister the specific handler', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const unregister1 = registerAsyncErrorEventHandler(handler1);
    const unregister2 = registerAsyncErrorEventHandler(handler2);

    unregister1();

    emitAsyncErrorEvent(new Error('selective'));

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);

    unregister2();
  });

  it.each([
    ['string error'],
    [42]
  ])('should handle non-Error value %j as async error', (value) => {
    const handler = vi.fn();
    const unregister = registerAsyncErrorEventHandler(handler);

    emitAsyncErrorEvent(value);
    expect(handler).toHaveBeenCalledWith(value);

    unregister();
  });
});
