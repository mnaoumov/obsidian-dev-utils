// eslint-disable-next-line import-x/no-nodejs-modules -- needed for mock child process
import { EventEmitter } from 'node:events';
// eslint-disable-next-line import-x/no-nodejs-modules -- needed for mock child process
import { PassThrough } from 'node:stream';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { exec } from '../../src/ScriptUtils/Exec.ts';

vi.mock('../../src/Debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

interface MockChild extends EventEmitter {
  stderr: PassThrough;
  stdin: PassThrough;
  stdout: PassThrough;
}

function createMockChild(): MockChild {
  const child = new EventEmitter() as MockChild;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  return child;
}

const { mockSpawn } = vi.hoisted(() => ({
  mockSpawn: vi.fn()
}));

vi.mock('../../src/ScriptUtils/NodeModules.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/ScriptUtils/NodeModules.ts')>();
  return {
    ...mod,
    spawn: mockSpawn
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('exec', () => {
  it('should resolve with stdout on successful command', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec('echo hello', { isQuiet: true });

    child.stdout.push(Buffer.from('hello'));
    child.stdout.push(null);
    child.stderr.push(null);
    child.emit('close', 0, null);

    const result = await promise;
    expect(result).toBe('hello');
  });

  it('should reject when command fails with non-zero exit code', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec('fail', { isQuiet: true });

    child.stdout.push(null);
    child.stderr.push(Buffer.from('error output'));
    child.stderr.push(null);
    child.emit('close', 1, null);

    await expect(promise).rejects.toThrow('Command failed with exit code 1');
  });

  it('should resolve with stdout when shouldIgnoreExitCode is true', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec('fail', { isQuiet: true, shouldIgnoreExitCode: true });

    child.stdout.push(Buffer.from('partial'));
    child.stdout.push(null);
    child.stderr.push(null);
    child.emit('close', 1, null);

    const result = await promise;
    expect(result).toBe('partial');
  });

  it('should return ExecResult when shouldIncludeDetails is true', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec('cmd', { isQuiet: true, shouldIncludeDetails: true });

    child.stdout.push(Buffer.from('out'));
    child.stdout.push(null);
    child.stderr.push(Buffer.from('err'));
    child.stderr.push(null);
    child.emit('close', 0, null);

    const result = await promise;
    expect(result).toEqual({
      exitCode: 0,
      exitSignal: null,
      stderr: 'err',
      stdout: 'out'
    });
  });

  it('should convert array command to command line', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec(['echo', 'hello world'], { isQuiet: true });

    child.stdout.push(Buffer.from('hello world'));
    child.stdout.push(null);
    child.stderr.push(null);
    child.emit('close', 0, null);

    await promise;
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it('should handle spawn error event', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec('bad', { isQuiet: true });

    child.stdout.push(null);
    child.stderr.push(null);
    child.emit('error', new Error('spawn failed'));

    await expect(promise).rejects.toThrow('spawn failed');
  });

  it('should resolve on error when shouldIgnoreExitCode is true', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec('bad', { isQuiet: true, shouldIgnoreExitCode: true });

    child.stdout.push(Buffer.from('partial'));
    child.stdout.push(null);
    child.stderr.push(null);
    child.emit('error', new Error('spawn failed'));

    const result = await promise;
    expect(result).toBe('partial');
  });

  it('should return ExecResult on error with shouldIgnoreExitCode and shouldIncludeDetails', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec('bad', { isQuiet: true, shouldIgnoreExitCode: true, shouldIncludeDetails: true });

    child.stdout.push(null);
    child.stderr.push(Buffer.from('err'));
    child.stderr.push(null);
    child.emit('error', new Error('spawn failed'));

    const result = await promise;
    expect(result).toEqual({
      exitCode: null,
      exitSignal: null,
      stderr: 'err',
      stdout: ''
    });
  });

  it('should handle null exit code in error message', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec('killed', { isQuiet: true });

    child.stdout.push(null);
    child.stderr.push(null);
    child.emit('close', null, 'SIGTERM');

    await expect(promise).rejects.toThrow('exit code (null)');
  });

  it('should write stdin to child process', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);
    const chunks: Buffer[] = [];
    child.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));

    const promise = exec('cat', { isQuiet: true, stdin: 'input data' });

    child.stdout.push(null);
    child.stderr.push(null);
    child.emit('close', 0, null);

    await promise;
    expect(Buffer.concat(chunks).toString()).toBe('input data');
  });

  it('should trim one trailing newline from stdout and stderr', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec('cmd', { isQuiet: true, shouldIncludeDetails: true });

    child.stdout.push(Buffer.from('output\n'));
    child.stdout.push(null);
    child.stderr.push(Buffer.from('warning\n'));
    child.stderr.push(null);

    // Wait for both stream 'end' events (which do the trimming) before emitting close
    await Promise.all([
      new Promise<void>((resolve) => {
        child.stdout.on('end', resolve);
      }),
      new Promise<void>((resolve) => {
        child.stderr.on('end', resolve);
      })
    ]);
    child.emit('close', 0, null);

    const result = await promise;
    expect(result).toEqual({
      exitCode: 0,
      exitSignal: null,
      stderr: 'warning',
      stdout: 'output'
    });
  });
});
