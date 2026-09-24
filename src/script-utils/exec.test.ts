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
import {
  appendNodeOption,
  buildChildEnv,
  exec
} from './exec.ts';

vi.mock('../debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

interface MockChild extends EventEmitter {
  stderr: PassThrough;
  stdin: PassThrough;
  stdout: PassThrough;
}

interface SpawnCallOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly stdio?: string;
}

/**
 * The batch budget `exec` applies on Windows: the raw 8191 less the 2048 reserved for the expansions the
 * spawned command performs on its own arguments. Mirrors `WINDOWS_CHILD_EXPANSION_RESERVE` in `exec.ts`.
 */
const WINDOWS_MAX_BATCH_COMMAND_LENGTH = 8191 - 2048;

function createMockChild(): MockChild {
  // eslint-disable-next-line unicorn/prefer-event-target -- This stands in for a Node `ChildProcess`, which IS an `EventEmitter`. The code under test calls `.on(...)` and reads emitter semantics, so an `EventTarget` would not be a substitute.
  const child = new EventEmitter() as MockChild;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  return child;
}

function mockSpawnSequence(): void {
  mockSpawn.mockImplementation(() => {
    const child = createMockChild();
    // eslint-disable-next-line obsidianmd/prefer-window-timers -- Node-only test environment; activeWindow is not available.
    setTimeout(() => {
      child.stdout.end();
      child.stderr.end();
      child.emit('close', 0, null);
    }, 0);
    return child;
  });
}

function setComSpec(value: string | undefined): void {
  if (value === undefined) {
    delete process.env['comspec'];
    return;
  }
  process.env['comspec'] = value;
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
  const $module = await importOriginal<typeof import('node:child_process')>();
  return {
    ...$module,
    spawn: mockSpawn
  };
});

vi.mock('node:process', async (importOriginal) => {
  const $module = await importOriginal<typeof import('node:process')>();
  const mockProcess = {
    ...$module,
    cwd: (): string => $module.cwd(),
    env: $module.env,
    stderr: { write: mockStderrWrite },
    stdout: { write: mockStdoutWrite }
  };
  Object.defineProperty(mockProcess, 'platform', {
    configurable: true,
    enumerable: true,
    get: () => process.platform
  });
  return {
    ...$module,
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
      const longCommand = 'a'.repeat(131_073);
      await expect(exec(longCommand)).rejects.toThrow('Command line is too long');
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should reject when array command exceeds max length', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const longArgument = 'a'.repeat(8192);
      await expect(exec(['echo', longArgument])).rejects.toThrow('Command line is too long');
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
      exec(['cmd', { batchedArguments: ['a'] }, { batchedArguments: ['b'] }])
    ).rejects.toThrow('Only one ExecArg with batchedArguments is allowed');
  });

  it('should expand ExecArg inline when total length is within limit', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec(['echo', { batchedArguments: ['a', 'b', 'c'] }], { isQuiet: true });

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

  it('should quote batched args that contain spaces so they stay a single argument on POSIX', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    try {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);

      const promise = exec(['echo', { batchedArguments: ['foo bar/baz.md', 'plain.md'] }], { isQuiet: true });

      child.stdout.end('ok');
      child.stderr.end('');
      child.emit('close', 0, null);

      await expect(promise).resolves.toBe('ok');
      const firstCall = mockSpawn.mock.calls[0];
      assertNonNullable(firstCall);
      const calledCommand = firstCall[0] as string;
      expect(calledCommand).toBe('echo \'foo bar/baz.md\' plain.md');
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should single-quote batched args containing shell metacharacters on POSIX', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    try {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);

      const promise = exec(['echo', { batchedArguments: ['foo$x.md', 'a;b.md', 'c*.md', 'd\'e.md'] }], { isQuiet: true });

      child.stdout.end('ok');
      child.stderr.end('');
      child.emit('close', 0, null);

      await expect(promise).resolves.toBe('ok');
      const firstCall = mockSpawn.mock.calls[0];
      assertNonNullable(firstCall);
      expect(firstCall[0]).toBe(String.raw`echo 'foo$x.md' 'a;b.md' 'c*.md' 'd'\''e.md'`);
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should single-quote static args containing shell metacharacters on POSIX', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    try {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);

      const promise = exec(['echo', 'a b$c'], { isQuiet: true });

      child.stdout.end('ok');
      child.stderr.end('');
      child.emit('close', 0, null);

      await expect(promise).resolves.toBe('ok');
      const firstCall = mockSpawn.mock.calls[0];
      assertNonNullable(firstCall);
      expect(firstCall[0]).toBe('echo \'a b$c\'');
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should caret-escape batched args containing cmd metacharacters on Windows', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);

      const promise = exec(['echo', { batchedArguments: ['a&b.md', '(c).md'] }], { isQuiet: true });

      child.stdout.end('ok');
      child.stderr.end('');
      child.emit('close', 0, null);

      await expect(promise).resolves.toBe('ok');
      const firstCall = mockSpawn.mock.calls[0];
      assertNonNullable(firstCall);
      expect(firstCall[0]).toBe('echo a^&b.md ^(c^).md');
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should split ExecArg into batches when total exceeds limit', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const longArgument = 'x'.repeat(4000);
      const children = [createMockChild(), createMockChild(), createMockChild()];
      let callIndex = 0;
      mockSpawn.mockImplementation(() => {
        const child = children[callIndex];
        assertNonNullable(child);
        callIndex++;
        // eslint-disable-next-line obsidianmd/prefer-window-timers -- Node-only test environment; activeWindow is not available.
        setTimeout(() => {
          child.stdout.push(Buffer.from(`out${String(callIndex)}`));
          child.stdout.end();
          child.stderr.end();
          child.emit('close', 0, null);
        }, 0);
        return child;
      });

      const result = await exec(['echo', { batchedArguments: [longArgument, longArgument, longArgument] }], { isQuiet: true });

      // One argument per batch: two of them (8005 chars) exceed the batch budget of 8191 - 2048.
      expect(mockSpawn).toHaveBeenCalledTimes(3);
      expect(result).toContain('out');
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should return ExecResult when shouldIncludeDetails is true with batched args that split', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const longArgument = 'x'.repeat(4000);
      const children = [createMockChild(), createMockChild(), createMockChild()];
      let callIndex = 0;
      mockSpawn.mockImplementation(() => {
        const child = children[callIndex];
        assertNonNullable(child);
        callIndex++;
        // eslint-disable-next-line obsidianmd/prefer-window-timers -- Node-only test environment; activeWindow is not available.
        setTimeout(() => {
          child.stdout.push(Buffer.from(`batch${String(callIndex)}`));
          child.stdout.end();
          child.stderr.end();
          child.emit('close', 0, null);
        }, 0);
        return child;
      });

      const result = await exec(['echo', { batchedArguments: [longArgument, longArgument, longArgument] }], { isQuiet: true, shouldIncludeDetails: true });

      expect(result).toEqual({
        exitCode: 0,
        exitSignal: null,
        stderr: '',
        stdout: 'batch1\nbatch2\nbatch3'
      });
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should reject when a single batched arg exceeds max length', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const hugeArgument = 'x'.repeat(8192);
      await expect(
        exec(['echo', { batchedArguments: [hugeArgument] }])
      ).rejects.toThrow('Cannot split');
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should split a batched command that fits the raw Windows limit but not the reserved batch budget', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      mockSpawnSequence();

      // 7004 chars assembled: under the raw 8191 (so the earlier, unreserved budget sent it as ONE `cmd.exe` command
      // that then died with `The command line is too long.`), over the 8191 - 2048 batch budget.
      const $arguments = Array.from({ length: 70 }, () => 'a'.repeat(99));
      await exec(['echo', { batchedArguments: $arguments }], { isQuiet: true });

      expect(mockSpawn.mock.calls.length).toBeGreaterThan(1);
      for (const [command] of mockSpawn.mock.calls as [string][]) {
        expect(command.length).toBeLessThanOrEqual(WINDOWS_MAX_BATCH_COMMAND_LENGTH);
      }
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should count the ^-escaping toward the batch budget', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      // Same assembled length either way; only the cmd metacharacters grow once `^`-escaped.
      const plainArguments = Array.from({ length: 60 }, () => 'a'.repeat(99));
      const metaArguments = Array.from({ length: 60 }, () => `${'a'.repeat(94)}&&&&&`);
      expect(plainArguments.join(' ').length).toBe(metaArguments.join(' ').length);

      mockSpawnSequence();
      await exec(['echo', { batchedArguments: plainArguments }], { isQuiet: true });
      expect(mockSpawn).toHaveBeenCalledTimes(1);

      mockSpawn.mockClear();
      mockSpawnSequence();
      await exec(['echo', { batchedArguments: metaArguments }], { isQuiet: true });
      expect(mockSpawn.mock.calls.length).toBeGreaterThan(1);
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should not reserve any batch budget off Windows', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    try {
      mockSpawnSequence();

      const $arguments = Array.from({ length: 70 }, () => 'a'.repeat(99));
      await exec(['echo', { batchedArguments: $arguments }], { isQuiet: true });

      expect(mockSpawn).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should count the cmd.exe wrapper toward the hard limit of a non-batched command', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      // 8185 chars assembled — under the raw 8191, over it once `cmd.exe /d /s /c "..."` is added.
      await expect(exec(['echo', 'x'.repeat(8180)])).rejects.toThrow('Command line is too long');
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should count the length of the ComSpec path itself toward the batch budget', async () => {
    const originalPlatform = process.platform;
    const originalComSpec = process.env['comspec'];
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      // 6004 chars assembled: inside the 6143 batch budget with the shortest possible wrapper, outside it with a long one.
      const $arguments = Array.from({ length: 60 }, () => 'a'.repeat(99));

      setComSpec(undefined);
      mockSpawnSequence();
      await exec(['echo', { batchedArguments: $arguments }], { isQuiet: true });
      expect(mockSpawn).toHaveBeenCalledTimes(1);

      setComSpec(`C:\\${'nested\\'.repeat(40)}cmd.exe`);
      mockSpawn.mockClear();
      mockSpawnSequence();
      await exec(['echo', { batchedArguments: $arguments }], { isQuiet: true });
      expect(mockSpawn.mock.calls.length).toBeGreaterThan(1);
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      setComSpec(originalComSpec);
    }
  });

  it('should report the first failing batch instead of aggregating to a success', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const longArgument = 'x'.repeat(4000);
      const exitCodes = [0, 3, 0];
      let callIndex = 0;
      mockSpawn.mockImplementation(() => {
        const child = createMockChild();
        const index = callIndex;
        callIndex++;
        // eslint-disable-next-line obsidianmd/prefer-window-timers -- Node-only test environment; activeWindow is not available.
        setTimeout(() => {
          child.stdout.end(`out${String(index)}`);
          child.stderr.end(index === 1 ? 'boom' : '');
          child.emit('close', exitCodes[index], null);
        }, 0);
        return child;
      });

      const result = await exec(['echo', { batchedArguments: [longArgument, longArgument, longArgument] }], {
        isQuiet: true,
        shouldIgnoreExitCode: true,
        shouldIncludeDetails: true
      });

      expect(result).toEqual({
        exitCode: 3,
        exitSignal: null,
        stderr: 'boom',
        stdout: 'out0\nout1\nout2'
      });
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it.each([
    {
      expected: { exitCode: 3_221_225_477, exitSignal: null },
      label: 'a crash in a later batch outranks findings in an earlier one',
      results: [[1, null], [3_221_225_477, null], [1, null]] as const
    },
    {
      expected: { exitCode: null, exitSignal: 'SIGKILL' },
      label: 'a signal in a later batch outranks findings in an earlier one',
      results: [[1, null], [null, 'SIGKILL'], [0, null]] as const
    },
    {
      expected: { exitCode: 3_221_225_477, exitSignal: null },
      label: 'an earlier crash is not displaced by later findings',
      results: [[3_221_225_477, null], [1, null], [null, 'SIGKILL']] as const
    }
  ])('should aggregate batches so that $label', async ({ expected, results }) => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const longArgument = 'x'.repeat(4000);
      let callIndex = 0;
      mockSpawn.mockImplementation(() => {
        const child = createMockChild();
        const result = results[callIndex];
        assertNonNullable(result);
        callIndex++;
        // eslint-disable-next-line obsidianmd/prefer-window-timers -- Node-only test environment; activeWindow is not available.
        setTimeout(() => {
          child.stdout.end();
          child.stderr.end();
          child.emit('close', result[0], result[1]);
        }, 0);
        return child;
      });

      const result = await exec(['eslint', { batchedArguments: [longArgument, longArgument, longArgument] }], {
        isQuiet: true,
        shouldIgnoreExitCode: true,
        shouldIncludeDetails: true
      });

      expect(result).toMatchObject(expected);
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

  describe('failure classification', () => {
    interface FailingRun {
      readonly command?: string;
      readonly exitCode: null | number;
      readonly exitSignal?: NodeJS.Signals | null;
      readonly isInteractive?: boolean;
      readonly isQuiet?: boolean;
      readonly stderr?: string;
      readonly stdout?: string;
    }

    async function getFailureMessage(run: FailingRun): Promise<string> {
      mockSpawn.mockImplementation(() => {
        const child = createMockChild();
        // eslint-disable-next-line obsidianmd/prefer-window-timers -- Node-only test environment; activeWindow is not available.
        setTimeout(() => {
          child.stdout.end(run.stdout ?? '');
          child.stderr.end(run.stderr ?? '');
          // eslint-disable-next-line obsidianmd/prefer-window-timers -- Node-only test environment; activeWindow is not available.
          setTimeout(() => {
            child.emit('close', run.exitCode, run.exitSignal ?? null);
          }, 0);
        }, 0);
        return child;
      });

      try {
        await exec(run.command ?? 'eslint .', {
          isInteractive: run.isInteractive ?? false,
          isQuiet: run.isQuiet ?? true
        });
      } catch (error) {
        assertNonNullable(error);
        return (error as Error).message;
      }
      throw new Error('Expected exec to reject');
    }

    it('should name a silent access violation a crash and say it is not a finding', async () => {
      const message = await getFailureMessage({ exitCode: 3_221_225_477 });
      expect(message).toBe([
        'Command failed with exit code 3221225477 (NTSTATUS 0xC0000005 STATUS_ACCESS_VIOLATION)',
        'Command: eslint .',
        'The child process crashed before writing anything to stdout or stderr. This is not a failure the tool reported (not a lint finding, not a type error): re-run the command.'
      ].join('\n'));
    });

    it('should read a signed NTSTATUS the same as the unsigned one', async () => {
      const message = await getFailureMessage({ exitCode: -1_073_741_819 });
      expect(message).toContain('(NTSTATUS 0xC0000005 STATUS_ACCESS_VIOLATION)');
      expect(message).toContain('crashed before writing anything');
    });

    it('should show an unnamed NTSTATUS in hex', async () => {
      const message = await getFailureMessage({ exitCode: 0xC0_00_01_42 });
      expect(message).toContain('(NTSTATUS 0xC0000142)');
      expect(message).toContain('The child process crashed before');
    });

    it('should call a Ctrl+C exit an interruption, not a crash', async () => {
      const message = await getFailureMessage({ exitCode: 0xC0_00_01_3A });
      expect(message).toContain('STATUS_CONTROL_C_EXIT');
      expect(message).toContain('The child process was interrupted before writing anything');
    });

    it('should say the output may be incomplete when a crashed child had written something', async () => {
      const message = await getFailureMessage({ exitCode: 3_221_225_477, stderr: 'partial' });
      expect(message).toContain('The child process crashed rather than exiting on its own, so any output it wrote may be incomplete.');
      expect(message).toContain('stderr:\npartial');
      expect(message).not.toContain('re-run');
    });

    it('should not claim an interactive child wrote nothing, since its output was never captured', async () => {
      const message = await getFailureMessage({ exitCode: 3_221_225_477, isInteractive: true });
      expect(message).toContain('so any output it wrote may be incomplete');
    });

    it.each([
      ['process.exit(-1)', 0xFF_FF_FF_FF],
      ['process.exit(-1), signed', -1],
      ['an unhandled C++ exception', 0xE0_6D_73_63],
      ['an ordinary finding count', 1]
    ])('should not classify %s as an NTSTATUS crash', async (_label, exitCode) => {
      const message = await getFailureMessage({ exitCode, stderr: 'found problems' });
      expect(message).not.toContain('NTSTATUS');
      expect(message).not.toContain('The child process');
      expect(message.startsWith(`Command failed with exit code ${String(exitCode)}\n`)).toBe(true);
    });

    it('should name the signal that killed a child and call a silent one not a finding', async () => {
      const message = await getFailureMessage({ exitCode: null, exitSignal: 'SIGSEGV' });
      expect(message).toBe([
        'Command failed with exit code (null), terminated by signal SIGSEGV',
        'Command: eslint .',
        'The child process was killed by SIGSEGV before writing anything to stdout or stderr. This is not a failure the tool reported (not a lint finding, not a type error): re-run the command.'
      ].join('\n'));
    });

    it('should carry stdout in full when quiet mode hid it', async () => {
      const message = await getFailureMessage({ exitCode: 1, stdout: 'a.ts\n  1:1 error' });
      expect(message).toBe([
        'Command failed with exit code 1',
        'Command: eslint .',
        'stdout:\na.ts\n  1:1 error'
      ].join('\n'));
    });

    it('should only count the stdout lines when they were already printed', async () => {
      const message = await getFailureMessage({ exitCode: 1, isQuiet: false, stderr: 'oops', stdout: 'a\nb' });
      expect(message).toBe([
        'Command failed with exit code 1',
        'Command: eslint .',
        'stdout: 2 line(s), printed above.',
        'stderr:\noops'
      ].join('\n'));
    });

    it('should truncate a long command in the message', async () => {
      const command = `eslint ${'x'.repeat(1000)}`;
      const message = await getFailureMessage({ command, exitCode: 1 });
      expect(message).toContain(`Command: ${command.slice(0, 500)}…\n`.trimEnd());
      expect(message).not.toContain(command);
    });

    it('should name the command a spawn error came from and keep the original as its cause', async () => {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);
      const spawnError = new Error('spawn ENOENT');

      const promise = exec('missing-tool --flag', { isQuiet: true });
      child.emit('error', spawnError);

      await expect(promise).rejects.toThrow('Could not run command: missing-tool --flag\nspawn ENOENT');
      await expect(promise).rejects.toMatchObject({ cause: spawnError });
    });
  });

  it('should write stdin to child process', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);
    const chunks: Buffer[] = [];
    child.stdin.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

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

  it('should spawn child processes with an in-memory localStorage NODE_OPTIONS', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec('cmd', { isQuiet: true });

    child.stdout.end();
    child.stderr.end();
    child.emit('close', 0, null);

    await promise;

    const firstCall = mockSpawn.mock.calls[0];
    assertNonNullable(firstCall);
    const spawnOptions = firstCall[2] as SpawnCallOptions;
    expect(spawnOptions.env?.['NODE_OPTIONS']).toContain('--localstorage-file=:memory:');
  });

  it('should pass a variable set after this module was imported to the child', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    // `.env` is loaded by `wrapCliTask`, which necessarily runs after every import has been
    // evaluated. A child environment captured at module scope would predate that and drop the
    // variable, leaving every spawned gate blind to the repo's own `.env`.
    vi.stubEnv('SET_AFTER_IMPORT', 'late-value');
    try {
      const promise = exec('cmd', { isQuiet: true });

      child.stdout.end();
      child.stderr.end();
      child.emit('close', 0, null);

      await promise;

      const firstCall = mockSpawn.mock.calls[0];
      assertNonNullable(firstCall);
      const spawnOptions = firstCall[2] as SpawnCallOptions;
      expect(spawnOptions.env?.['SET_AFTER_IMPORT']).toBe('late-value');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('should merge the env option over the inherited child environment', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec(['echo', 'hi'], {
      env: { MY_CUSTOM_VAR: 'custom-value' },
      isQuiet: true
    });

    child.stdout.end('hi');
    child.stderr.end('');
    child.emit('close', 0, null);

    await expect(promise).resolves.toBe('hi');
    const firstCall = mockSpawn.mock.calls[0];
    assertNonNullable(firstCall);
    const spawnOptions = firstCall[2] as SpawnCallOptions;
    expect(spawnOptions.env?.['MY_CUSTOM_VAR']).toBe('custom-value');
  });

  it('should attach stdio to the terminal and not capture output when isInteractive is true', async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child);

    const promise = exec(['astro', 'dev'], { isInteractive: true });

    child.emit('close', 0, null);

    await expect(promise).resolves.toBe('');
    const firstCall = mockSpawn.mock.calls[0];
    assertNonNullable(firstCall);
    const spawnOptions = firstCall[2] as SpawnCallOptions;
    expect(spawnOptions.stdio).toBe('inherit');
  });
});

describe('appendNodeOption', () => {
  it('should return the option alone when there are no existing options', () => {
    expect(appendNodeOption(undefined, '--localstorage-file=:memory:')).toBe('--localstorage-file=:memory:');
    expect(appendNodeOption(' '.repeat(3), '--localstorage-file=:memory:')).toBe('--localstorage-file=:memory:');
  });

  it('should append the option, preserving existing options', () => {
    expect(appendNodeOption('--max-old-space-size=4096', '--localstorage-file=:memory:'))
      .toBe('--max-old-space-size=4096 --localstorage-file=:memory:');
  });

  it('should not duplicate an option that is already present', () => {
    expect(appendNodeOption('--localstorage-file=:memory:', '--localstorage-file=:memory:'))
      .toBe('--localstorage-file=:memory:');
    expect(appendNodeOption('--foo --localstorage-file=:memory: --bar', '--localstorage-file=:memory:'))
      .toBe('--foo --localstorage-file=:memory: --bar');
  });
});

describe('buildChildEnv', () => {
  it('should append the localStorage option to NODE_OPTIONS when node supports it', () => {
    const env = buildChildEnv({ NODE_OPTIONS: '--max-old-space-size=4096' }, new Set(['--localstorage-file']));
    expect(env['DEBUG_COLORS']).toBe('1');
    expect(env['NODE_OPTIONS']).toBe('--max-old-space-size=4096 --localstorage-file=:memory:');
  });

  it('should set the localStorage option as the sole NODE_OPTIONS when none exist', () => {
    const env = buildChildEnv({}, new Set(['--localstorage-file']));
    expect(env['NODE_OPTIONS']).toBe('--localstorage-file=:memory:');
  });

  it('should leave an existing NODE_OPTIONS untouched when node does not support the localStorage option', () => {
    const env = buildChildEnv({ NODE_OPTIONS: '--max-old-space-size=4096' }, new Set());
    expect(env['DEBUG_COLORS']).toBe('1');
    expect(env['NODE_OPTIONS']).toBe('--max-old-space-size=4096');
  });

  it('should not add NODE_OPTIONS when node does not support the option and none exist', () => {
    const env = buildChildEnv({}, new Set());
    expect('NODE_OPTIONS' in env).toBe(false);
  });
});
