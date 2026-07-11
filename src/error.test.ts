import {
  afterEach,
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
  ignoreUnhandledAsyncErrors,
  printError,
  registerAsyncErrorEventHandler,
  SilentError,
  startCollectingUnhandledAsyncErrors,
  stopCollectingUnhandledAsyncErrors,
  throwExpression
} from './error.ts';
import { strictProxy } from './strict-proxy.ts';
import { assertNonNullable } from './type-guards.ts';

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

  it('should include the message of an AggregateError', () => {
    const error = new AggregateError([new Error('first'), new Error('second')], 'multiple failures');
    const result = errorToString(error);
    expect(result).toContain('multiple failures');
  });

  it('should include the first aggregated error label for an AggregateError', () => {
    const error = new AggregateError([new Error('first'), new Error('second')]);
    const result = errorToString(error);
    expect(result).toContain('Aggregated error #1:');
  });

  it('should include the second aggregated error label for an AggregateError', () => {
    const error = new AggregateError([new Error('first'), new Error('second')]);
    const result = errorToString(error);
    expect(result).toContain('Aggregated error #2:');
  });

  it('should include the first aggregated error message for an AggregateError', () => {
    const error = new AggregateError([new Error('first failure'), new Error('second failure')]);
    const result = errorToString(error);
    expect(result).toContain('first failure');
  });

  it('should include the second aggregated error message for an AggregateError', () => {
    const error = new AggregateError([new Error('first failure'), new Error('second failure')]);
    const result = errorToString(error);
    expect(result).toContain('second failure');
  });

  it('should include a non-Error aggregated value of an AggregateError', () => {
    const error = new AggregateError(['string failure']);
    const result = errorToString(error);
    expect(result).toContain('string failure');
  });

  it('should include the cause of an AggregateError that also has a cause', () => {
    const error = new AggregateError([new Error('aggregated')], 'agg', { cause: new Error('root cause') });
    const result = errorToString(error);
    expect(result).toContain('root cause');
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
    const error = new CustomStackTraceError({
      cause,
      message: 'wrapped',
      stackTrace: customStack
    });
    expect(error).toBeInstanceOf(Error);
  });

  it('should be an instance of CustomStackTraceError', () => {
    const customStack = '    at customFunction (file.ts:10:5)\n    at main (file.ts:20:3)';
    const cause = new Error('original');
    const error = new CustomStackTraceError({
      cause,
      message: 'wrapped',
      stackTrace: customStack
    });
    expect(error).toBeInstanceOf(CustomStackTraceError);
  });

  it('should have name set to CustomStackTraceError', () => {
    const customStack = '    at customFunction (file.ts:10:5)\n    at main (file.ts:20:3)';
    const cause = new Error('original');
    const error = new CustomStackTraceError({
      cause,
      message: 'wrapped',
      stackTrace: customStack
    });
    expect(error.name).toBe('CustomStackTraceError');
  });

  it('should have the correct message', () => {
    const customStack = '    at customFunction (file.ts:10:5)\n    at main (file.ts:20:3)';
    const cause = new Error('original');
    const error = new CustomStackTraceError({
      cause,
      message: 'wrapped',
      stackTrace: customStack
    });
    expect(error.message).toBe('wrapped');
  });

  it('should have the correct cause', () => {
    const customStack = '    at customFunction (file.ts:10:5)\n    at main (file.ts:20:3)';
    const cause = new Error('original');
    const error = new CustomStackTraceError({
      cause,
      message: 'wrapped',
      stackTrace: customStack
    });
    expect(error.cause).toBe(cause);
  });

  it('should include the custom stack frames', () => {
    const customStack = '    at customFunction (file.ts:10:5)\n    at main (file.ts:20:3)';
    const cause = new Error('original');
    const error = new CustomStackTraceError({
      cause,
      message: 'wrapped',
      stackTrace: customStack
    });
    expect(error.stack).toContain('customFunction');
  });

  it('should include all provided stack frames', () => {
    const customStack = '    at customFunction (file.ts:10:5)\n    at main (file.ts:20:3)';
    const cause = new Error('original');
    const error = new CustomStackTraceError({
      cause,
      message: 'wrapped',
      stackTrace: customStack
    });
    expect(error.stack).toContain('main');
  });

  it('should replace the error header with CustomStackTraceError header', () => {
    const customStack = 'Error: some message\n    at fn (file.ts:1:1)';
    const error = new CustomStackTraceError({
      cause: null,
      message: 'test',
      stackTrace: customStack
    });
    expect(error.stack).toContain('CustomStackTraceError: test');
  });

  it('should preserve stack frames when stripping the error header', () => {
    const customStack = 'Error: some message\n    at fn (file.ts:1:1)';
    const error = new CustomStackTraceError({
      cause: null,
      message: 'test',
      stackTrace: customStack
    });
    expect(error.stack).toContain('at fn (file.ts:1:1)');
  });

  it('should detect circular causes and throw', () => {
    const error1 = new CustomStackTraceError({
      cause: null,
      message: 'first',
      stackTrace: '    at a (a.ts:1:1)'
    });
    // Manually set circular cause
    Object.defineProperty(error1, 'cause', { value: error1, writable: true });

    expect(
      () =>
        new CustomStackTraceError({
          cause: error1,
          message: 'second',
          stackTrace: '    at b (b.ts:1:1)'
        })
    ).toThrow('Circular cause detected');
  });

  it('should set the correct message for deeply nested causes without circularity', () => {
    const inner = new CustomStackTraceError({
      cause: null,
      message: 'inner',
      stackTrace: '    at inner (inner.ts:1:1)'
    });
    const middle = new CustomStackTraceError({
      cause: inner,
      message: 'middle',
      stackTrace: '    at middle (middle.ts:1:1)'
    });
    const outer = new CustomStackTraceError({
      cause: middle,
      message: 'outer',
      stackTrace: '    at outer (outer.ts:1:1)'
    });
    expect(outer.message).toBe('outer');
  });

  it('should set the correct cause for deeply nested causes without circularity', () => {
    const inner = new CustomStackTraceError({
      cause: null,
      message: 'inner',
      stackTrace: '    at inner (inner.ts:1:1)'
    });
    const middle = new CustomStackTraceError({
      cause: inner,
      message: 'middle',
      stackTrace: '    at middle (middle.ts:1:1)'
    });
    const outer = new CustomStackTraceError({
      cause: middle,
      message: 'outer',
      stackTrace: '    at outer (outer.ts:1:1)'
    });
    expect(outer.cause).toBe(middle);
  });

  it('should handle non-CustomStackTraceError cause', () => {
    const cause = 'string cause';
    const error = new CustomStackTraceError({
      cause,
      message: 'test',
      stackTrace: '    at fn (file.ts:1:1)'
    });
    expect(error.cause).toBe('string cause');
  });
});

describe('printError', () => {
  it('should call console.error with the error string', () => {
    const mockConsole = strictProxy<Console>({ error: vi.fn() });
    const error = new Error('print me');

    printError(error, mockConsole);

    expect(mockConsole.error).toHaveBeenCalledTimes(1);
  });

  it('should include the error message in the output', () => {
    const mockConsole = strictProxy<Console>({ error: vi.fn() });
    const error = new Error('print me');

    printError(error, mockConsole);

    const firstCall = (mockConsole.error as ReturnType<typeof vi.fn>).mock.calls[0];
    assertNonNullable(firstCall);
    const output = firstCall[0] as string;
    expect(output).toContain('print me');
  });

  it('should call console.error once for non-Error values', () => {
    const mockConsole = strictProxy<Console>({ error: vi.fn() });
    printError('just a string', mockConsole);

    expect(mockConsole.error).toHaveBeenCalledTimes(1);
  });

  it('should pass the non-Error value directly to console.error', () => {
    const mockConsole = strictProxy<Console>({ error: vi.fn() });
    printError('just a string', mockConsole);

    const firstCall = (mockConsole.error as ReturnType<typeof vi.fn>).mock.calls[0];
    assertNonNullable(firstCall);
    expect(firstCall[0]).toBe('just a string');
  });

  it('should include the outer error message when printing nested causes', () => {
    const mockConsole = strictProxy<Console>({ error: vi.fn() });
    const cause = new Error('root');
    const error = new Error('outer', { cause });

    printError(error, mockConsole);

    const firstCall = (mockConsole.error as ReturnType<typeof vi.fn>).mock.calls[0];
    assertNonNullable(firstCall);
    const output = firstCall[0] as string;
    expect(output).toContain('outer');
  });

  it('should include the Caused by label when printing nested causes', () => {
    const mockConsole = strictProxy<Console>({ error: vi.fn() });
    const cause = new Error('root');
    const error = new Error('outer', { cause });

    printError(error, mockConsole);

    const firstCall = (mockConsole.error as ReturnType<typeof vi.fn>).mock.calls[0];
    assertNonNullable(firstCall);
    const output = firstCall[0] as string;
    expect(output).toContain('Caused by:');
  });

  it('should include the root cause message when printing nested causes', () => {
    const mockConsole = strictProxy<Console>({ error: vi.fn() });
    const cause = new Error('root');
    const error = new Error('outer', { cause });

    printError(error, mockConsole);

    const firstCall = (mockConsole.error as ReturnType<typeof vi.fn>).mock.calls[0];
    assertNonNullable(firstCall);
    const output = firstCall[0] as string;
    expect(output).toContain('root');
  });

  it('should include the aggregated errors when printing an AggregateError', () => {
    const mockConsole = strictProxy<Console>({ error: vi.fn() });
    const error = new AggregateError([new Error('child failure')], 'multiple failures');

    printError(error, mockConsole);

    const firstCall = (mockConsole.error as ReturnType<typeof vi.fn>).mock.calls[0];
    assertNonNullable(firstCall);
    const output = firstCall[0] as string;
    expect(output).toContain('child failure');
  });
});

describe('emitAsyncErrorEvent + registerAsyncErrorEventHandler', () => {
  it('should call the registered handler when an async error is emitted', () => {
    const handler = vi.fn();
    using _registration = registerAsyncErrorEventHandler(handler);

    const error = new Error('async error');
    emitAsyncErrorEvent(error);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(error);
  });

  it('should not call the handler after the disposable is disposed', () => {
    const handler = vi.fn();
    const registration = registerAsyncErrorEventHandler(handler);

    registration[Symbol.dispose]();

    // No consumer handler remains, so mark the deliberate emit as expected for the test harness.
    using _ignore = ignoreUnhandledAsyncErrors();
    emitAsyncErrorEvent(new Error('should not reach handler'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('should not call the handler after the registration using scope exits', () => {
    const handler = vi.fn();
    {
      using _registration = registerAsyncErrorEventHandler(handler);
    }

    // No consumer handler remains, so mark the deliberate emit as expected for the test harness.
    using _ignore = ignoreUnhandledAsyncErrors();
    emitAsyncErrorEvent(new Error('should not reach handler'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('should call all registered handlers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    using _registration1 = registerAsyncErrorEventHandler(handler1);
    using _registration2 = registerAsyncErrorEventHandler(handler2);

    const error = new Error('multi');
    emitAsyncErrorEvent(error);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler1).toHaveBeenCalledWith(error);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledWith(error);
  });

  it('should only unregister the specific handler', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const registration1 = registerAsyncErrorEventHandler(handler1);
    using _registration2 = registerAsyncErrorEventHandler(handler2);

    registration1[Symbol.dispose]();

    emitAsyncErrorEvent(new Error('selective'));

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['string error'],
    [42]
  ])('should handle non-Error value %j as async error', (value) => {
    const handler = vi.fn();
    using _registration = registerAsyncErrorEventHandler(handler);

    emitAsyncErrorEvent(value);
    expect(handler).toHaveBeenCalledWith(value);
  });
});

describe('unhandled async error collection', () => {
  afterEach(() => {
    // Close any window a test left open so it cannot leak into the global per-test harness.
    stopCollectingUnhandledAsyncErrors();
  });

  it('should collect an async error emitted while no consumer handler is registered', () => {
    startCollectingUnhandledAsyncErrors();
    const error = new Error('unhandled');

    emitAsyncErrorEvent(error);

    expect(stopCollectingUnhandledAsyncErrors()).toStrictEqual([error]);
  });

  it('should not collect an async error while a consumer handler is registered', () => {
    startCollectingUnhandledAsyncErrors();
    using _registration = registerAsyncErrorEventHandler(vi.fn());

    emitAsyncErrorEvent(new Error('handled'));

    expect(stopCollectingUnhandledAsyncErrors()).toStrictEqual([]);
  });

  it('should not collect an async error while no collection window is open', () => {
    stopCollectingUnhandledAsyncErrors();

    emitAsyncErrorEvent(new Error('no window'));

    expect(stopCollectingUnhandledAsyncErrors()).toStrictEqual([]);
  });

  it('should discard errors from a previous window when a new one is started', () => {
    startCollectingUnhandledAsyncErrors();
    emitAsyncErrorEvent(new Error('first window'));

    startCollectingUnhandledAsyncErrors();

    expect(stopCollectingUnhandledAsyncErrors()).toStrictEqual([]);
  });

  it('should not treat an emit inside ignoreUnhandledAsyncErrors as unhandled', () => {
    startCollectingUnhandledAsyncErrors();
    {
      using _ignore = ignoreUnhandledAsyncErrors();
      emitAsyncErrorEvent(new Error('ignored'));
    }

    // Once the scope exits the no-op consumer is gone, so a later emit is collected again.
    const laterError = new Error('collected');
    emitAsyncErrorEvent(laterError);

    expect(stopCollectingUnhandledAsyncErrors()).toStrictEqual([laterError]);
  });
});
