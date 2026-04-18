import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { assertNonNullable } from '../type-guards.ts';
import { exec } from './exec.ts';

vi.mock('../debug.ts', () => ({
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

const {
  mockSpawn,
  mockStderrWrite,
  mockStdoutWrite
} = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  mockStderrWrite: vi.fn(),
  mockStdoutWrite: vi.fn()
}));

vi.mock('node:child_process', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:child_process')>();
  return {
    ...mod,
    spawn: mockSpawn
  };
});

vi.mock('node:process', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:process')>();
  const mockProcess = {
    ...mod,
    cwd: (): string => mod.cwd(),
    env: mod.env,
    stderr: { write: mockStderrWrite },
    stdout: { write: mockStdoutWrite }
  };
  Object.defineProperty(mockProcess, 'platform', {
    configurable: true,
    enumerable: true,
    get: () => process.platform
  });
  return {
    ...mod,
    default: mockProcess
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('exec', () => {
  it('should reject when command exceeds Windows max length', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const longCommand = 'a'.repeat(8192);
      await expect(exec(longCommand)).rejects.toThrow('Command line is too long');
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should allow longer commands on non-Windows platforms', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    try {
      const longCommand = `echo ${'a'.repeat(8192)}`;
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);
      const promise = exec(longCommand);
      child.stdout.end('ok');
      child.stderr.end('');
      child.emit('close', 0, null);
      await expect(promise).resolves.toBe('ok');
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should reject when command exceeds non-Windows max length', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    try {
      const longCommand = 'a'.repeat(131073);
      await expect(exec(longCommand)).rejects.toThrow('Command line is too long');
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should reject when array command exceeds max length', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const longArg = 'a'.repeat(8192);
      await expect(exec(['echo', longArg])).rejects.toThrow('Command line is too long');
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should spawn directly without shell when command has newlines and raw args on Windows', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);
      const promise = exec(['echo', 'line1\nline2'], { isQuiet: true });
      child.stdout.end('line1\nline2');
      child.stderr.end('');
      child.emit('close', 0, null);
      const result = await promise;
      expect(result).toBe('line1\nline2');
      expect(mockSpawn).toHaveBeenCalledWith('echo', ['line1\nline2'], expect.objectContaining({ stdio: 'pipe' }));
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should throw when command has newlines but no raw args on Windows', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      await expect(exec('echo line1\nline2')).rejects.toThrow('newlines');
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should reject when more than one ExecArg is provided', async () => {
    await expect(
      exec(['cmd', { batchedArgs: ['a'] }, { batchedArgs: ['b'] }])
    ).rejects.toThrow('Only one ExecArg with batchedArgs is allowed');
  });

  it('should expand ExecArg inline when total length is within limit', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec(['echo', { batchedArgs: ['a', 'b', 'c'] }], { isQuiet: true });

    child.stdout.push(Buffer.from('a b c'));
    child.stdout.end();
    child.stderr.end();
    child.emit('close', 0, null);

    await expect(promise).resolves.toBe('a b c');
    const firstCall = mockSpawn.mock.calls[0];
    assertNonNullable(firstCall);
    const calledCommand = firstCall[0] as string;
    expect(calledCommand).toContain('echo');
    expect(calledCommand).toContain('a');
    expect(calledCommand).toContain('b');
    expect(calledCommand).toContain('c');
  });

  it('should split ExecArg into batches when total exceeds limit', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const longArg = 'x'.repeat(4000);
      const children = [createMockChild(), createMockChild()];
      let callIndex = 0;
      mockSpawn.mockImplementation(() => {
        const child = children[callIndex];
        assertNonNullable(child);
        callIndex++;
        // eslint-disable-next-line obsidianmd/prefer-active-window-timers -- Node-only test environment; activeWindow is not available.
        setTimeout(() => {
          child.stdout.push(Buffer.from(`out${String(callIndex)}`));
          child.stdout.end();
          child.stderr.end();
          child.emit('close', 0, null);
        });
        return child;
      });

      const result = await exec(['echo', { batchedArgs: [longArg, longArg, longArg] }], { isQuiet: true });

      expect(mockSpawn).toHaveBeenCalledTimes(2);
      expect(result).toContain('out');
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should return ExecResult when shouldIncludeDetails is true with batched args that split', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const longArg = 'x'.repeat(4000);
      const children = [createMockChild(), createMockChild()];
      let callIndex = 0;
      mockSpawn.mockImplementation(() => {
        const child = children[callIndex];
        assertNonNullable(child);
        callIndex++;
        // eslint-disable-next-line obsidianmd/prefer-active-window-timers -- Node-only test environment; activeWindow is not available.
        setTimeout(() => {
          child.stdout.push(Buffer.from(`batch${String(callIndex)}`));
          child.stdout.end();
          child.stderr.end();
          child.emit('close', 0, null);
        });
        return child;
      });

      const result = await exec(['echo', { batchedArgs: [longArg, longArg, longArg] }], { isQuiet: true, shouldIncludeDetails: true });

      expect(result).toEqual({
        exitCode: 0,
        exitSignal: null,
        stderr: '',
        stdout: ''
      });
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should reject when a single batched arg exceeds max length', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const hugeArg = 'x'.repeat(8192);
      await expect(
        exec(['echo', { batchedArgs: [hugeArg] }])
      ).rejects.toThrow('Cannot split');
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

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

  it('should write to process stdout and stderr when not quiet', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec('echo hello', { isQuiet: false });

    child.stdout.push(Buffer.from('out'));
    child.stdout.push(null);
    child.stderr.push(Buffer.from('err'));
    child.stderr.push(null);
    child.emit('close', 0, null);

    await promise;
    expect(mockStdoutWrite).toHaveBeenCalledWith(Buffer.from('out'));
    expect(mockStderrWrite).toHaveBeenCalledWith(Buffer.from('err'));
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
