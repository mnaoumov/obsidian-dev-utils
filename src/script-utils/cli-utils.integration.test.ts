import {
  dirname,
  resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  describe,
  expect,
  it
} from 'vitest';

import { exec } from './exec.ts';

const ECHO_ARGS = resolve(dirname(fileURLToPath(import.meta.url)), '../../scripts/helpers/echo-args.mjs');

/**
 * Executes the echo-args script with the given arguments via `exec` (array form)
 * and returns the parsed argv array as received by the child process.
 *
 * @param args - The arguments to pass.
 * @returns The argv array as received by the child process.
 */
async function echoArgs(...args: string[]): Promise<string[]> {
  const result = await exec(['node', ECHO_ARGS, ...args], { isQuiet: true });
  return JSON.parse(result) as string[];
}

describe('toCommandLine integration', () => {
  it('should pass a simple argument', async () => {
    const received = await echoArgs('hello');
    expect(received).toEqual(['hello']);
  });

  it('should pass an argument with spaces', async () => {
    const received = await echoArgs('hello world');
    expect(received).toEqual(['hello world']);
  });

  it('should pass an argument with double quotes', async () => {
    const received = await echoArgs('say "hi"');
    expect(received).toEqual(['say "hi"']);
  });

  it('should pass an argument with backslashes', async () => {
    const received = await echoArgs('C:\\Users\\test');
    expect(received).toEqual(['C:\\Users\\test']);
  });

  it('should pass an argument with trailing backslash and spaces', async () => {
    const received = await echoArgs('C:\\path with spaces\\');
    expect(received).toEqual(['C:\\path with spaces\\']);
  });

  it('should pass an empty argument', async () => {
    const received = await echoArgs('');
    expect(received).toEqual(['']);
  });

  it('should pass multiple mixed arguments', async () => {
    const received = await echoArgs('simple', 'with spaces', 'with "quotes"', '');
    expect(received).toEqual(['simple', 'with spaces', 'with "quotes"', '']);
  });

  it('should pass an argument with special shell characters', async () => {
    const received = await echoArgs('a & b | c > d < e');
    expect(received).toEqual(['a & b | c > d < e']);
  });

  it('should pass an argument with parentheses', async () => {
    const received = await echoArgs('(hello)');
    expect(received).toEqual(['(hello)']);
  });

  it('should pass an argument with percent signs', async () => {
    const received = await echoArgs('100%');
    expect(received).toEqual(['100%']);
  });

  it('should pass an argument with caret', async () => {
    const received = await echoArgs('a^b');
    expect(received).toEqual(['a^b']);
  });

  it('should pass an argument with exclamation marks', async () => {
    const received = await echoArgs('hello!');
    expect(received).toEqual(['hello!']);
  });

  it('should pass a complex nested quote argument', async () => {
    const received = await echoArgs('she said, "you had me at \\"hello\\""');
    expect(received).toEqual(['she said, "you had me at \\"hello\\""']);
  });

  it('should pass an argument with newlines', async () => {
    const received = await echoArgs('line1\nline2\nline3');
    expect(received).toEqual(['line1\nline2\nline3']);
  });

  it('should pass multiple arguments including one with newlines', async () => {
    const received = await echoArgs('normal', 'has\nnewline', 'also normal');
    expect(received).toEqual(['normal', 'has\nnewline', 'also normal']);
  });
});
