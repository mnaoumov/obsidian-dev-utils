/**
 * @file
 *
 * Contains utility functions for executing commands.
 */

import type { ChildProcessWithoutNullStreams } from 'node:child_process';

import { spawn } from 'node:child_process';
import process from 'node:process';

import { getLibDebugger } from '../debug.ts';
import { trimEnd } from '../string.ts';
import { assertNonNullable } from '../type-guards.ts';
import {
  cmdEscapeCommandLine,
  toCommandLine
} from './cli-utils.ts';

/**
 * A command part: either a plain string or an {@link ExecArg} with batched arguments.
 */
export type CommandPart = ExecArg | string;

/**
 * A command argument that contains a list of args to be batched.
 * If the expanded command exceeds the platform's max command length,
 * the batched args are split into sequential executions.
 */
export interface ExecArg {
  /**
   * The arguments to batch.
   */
  readonly batchedArgs: readonly string[];
}

/**
 * Options for {@link exec} that return detailed results.
 */
export interface ExecDetailedOptions extends ExecOption {
  /**
   * Must be `true` to receive detailed results.
   */
  readonly shouldIncludeDetails: true;
}

/**
 * Options for executing a command.
 */
export interface ExecOption {
  /**
   * A current working folder for the command execution.
   */
  readonly cwd?: string;

  /**
   * If `true`, suppresses the output of the command.
   */
  readonly isQuiet?: boolean;

  /**
   * If `true`, throws an error if the command fails.
   */
  readonly shouldFailIfCalledFromOutsideRoot?: boolean;

  /**
   * If `true`, ignores the exit code of the command.
   */
  readonly shouldIgnoreExitCode?: boolean;

  /**
   * If `false`, only returns the output of the command.
   */
  readonly shouldIncludeDetails?: boolean;

  /**
   * An input to be passed to the command.
   */
  readonly stdin?: string;
}

/**
 * A result of {@link exec}.
 */
export interface ExecResult {
  /**
   * An exit code of the command. A value of `null` indicates that the process did not exit normally.
   */
  readonly exitCode: null | number;

  /**
   * A signal that caused the process to be terminated. A value of `null` indicates that no signal was received.
   */
  readonly exitSignal: NodeJS.Signals | null;

  /**
   * A standard error output from the command.
   */
  readonly stderr: string;

  /**
   * A standard output from the command.
   */
  readonly stdout: string;
}

/**
 * Options for {@link exec} that return only stdout.
 */
export interface ExecSimpleOptions extends ExecOption {
  /**
   * Must be `false` or omitted to receive only stdout.
   */
  readonly shouldIncludeDetails?: false;
}

/**
 * Executes a command.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @returns A {@link Promise} that resolves with the output of the command.
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is `false`.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is `true`,
 *         the error is resolved with the stdout and stderr.
 */
export async function exec(command: CommandPart[] | string, options?: ExecSimpleOptions): Promise<string>;
/**
 * Executes a command.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @returns A {@link Promise} that resolves with ExecResult object.
 *          The ExecResult object contains the exit code, exit signal, stderr, and stdout.
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is `false`.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is `true`,
 *         the error is resolved with the stdout and stderr.
 */
export function exec(command: CommandPart[] | string, options: ExecDetailedOptions): Promise<ExecResult>;
/**
 * Executes a command.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @returns A {@link Promise} that resolves with the output of the command or an ExecResult object.
 *          The ExecResult object contains the exit code, exit signal, stderr, and stdout.
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is `false`.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is `true`,
 *         the error is resolved with the stdout and stderr.
 */
export function exec(command: CommandPart[] | string, options: ExecOption = {}): Promise<ExecResult | string> {
  if (Array.isArray(command)) {
    const batchResult = handleBatchedCommand(command, options);
    if (batchResult) {
      return batchResult;
    }
    const args = command.filter((part): part is string => typeof part === 'string');
    const commandLine = toCommandLine(args);

    const maxCommandLength = getMaxCommandLength();
    if (commandLine.length > maxCommandLength) {
      return Promise.reject(
        new Error(
          `Command line is too long (${String(commandLine.length)} chars, max ${
            String(maxCommandLength)
          } on ${process.platform}). Consider splitting into smaller batches or use ExecArg.`
        )
      );
    }

    return execString(commandLine, options, args);
  }

  const maxCommandLength = getMaxCommandLength();
  if (command.length > maxCommandLength) {
    return Promise.reject(
      new Error(
        `Command line is too long (${String(command.length)} chars, max ${
          String(maxCommandLength)
        } on ${process.platform}). Consider splitting into smaller batches or use ExecArg.`
      )
    );
  }

  return execString(command, options);
}

/**
 * Executes a single string command.
 *
 * @param command - The command string.
 * @param options - The exec options.
 * @param rawArgs - The original argument array (if available), used by the PowerShell
 *   fallback path to quote arguments with PowerShell-native single quotes.
 * @returns A Promise resolving to the result.
 */
function execString(command: string, options: ExecOption = {}, rawArgs?: string[]): Promise<ExecResult | string> {
  const {
    cwd = process.cwd(),
    isQuiet: quiet = false,
    shouldIgnoreExitCode: ignoreExitCode = false,
    shouldIncludeDetails = false,
    stdin = ''
  } = options;

  return new Promise((resolve, reject) => {
    getLibDebugger('Exec')(`Executing command: ${command}`);

    const child = spawnViaShell(command, cwd, rawArgs);

    let stdout = '';
    let stderr = '';

    child.stdin.write(stdin);
    child.stdin.end();

    child.stdout.on('data', (data: Buffer) => {
      if (!quiet) {
        process.stdout.write(data);
      }
      stdout += data.toString('utf-8');
    });

    child.stdout.on('end', () => {
      stdout = trimEnd(stdout, '\n');
    });

    child.stderr.on('data', (data: Buffer) => {
      if (!quiet) {
        process.stderr.write(data);
      }
      stderr += data.toString('utf-8');
    });

    child.stderr.on('end', () => {
      stderr = trimEnd(stderr, '\n');
    });

    child.on('close', (exitCode, exitSignal) => {
      if (exitCode !== 0 && !ignoreExitCode) {
        reject(new Error(`Command failed with exit code ${exitCode ? String(exitCode) : '(null)'}\n${stderr}`));
        return;
      }

      if (!shouldIncludeDetails) {
        resolve(stdout);
        return;
      }
      resolve({
        exitCode,
        exitSignal,
        stderr,
        stdout
      });
    });

    child.on('error', (err) => {
      if (!ignoreExitCode) {
        reject(err);
        return;
      }

      if (!shouldIncludeDetails) {
        resolve(stdout);
        return;
      }

      resolve({
        exitCode: null,
        exitSignal: null,
        stderr,
        stdout
      });
    });
  });
}

/**
 * Default environment variables passed to child processes.
 */
const CHILD_ENV = {
  DEBUG_COLORS: '1',
  ...process.env
};

/**
 * Executes batched commands sequentially and concatenates stdout.
 *
 * @param baseCommand - The base command without batched args.
 * @param batches - The batches of args.
 * @param options - The exec options.
 * @returns A Promise resolving to the concatenated result.
 */
async function executeBatches(baseCommand: string, batches: string[][], options: ExecOption): Promise<ExecResult | string> {
  const results: string[] = [];

  for (const batch of batches) {
    const batchCommand = `${baseCommand} ${batch.join(' ')}`;
    const result = await execString(batchCommand, options);
    if (typeof result === 'string') {
      results.push(result);
    }
  }

  if (options.shouldIncludeDetails) {
    return { exitCode: 0, exitSignal: null, stderr: '', stdout: results.join('\n') };
  }

  return results.join('\n');
}

/**
 * Returns the platform-specific max command line length.
 *
 * @returns The max command length in characters.
 */
function getMaxCommandLength(): number {
  const WINDOWS_MAX_COMMAND_LENGTH = 8191;
  const UNIX_MAX_COMMAND_LENGTH = 131072;
  return process.platform === 'win32' ? WINDOWS_MAX_COMMAND_LENGTH : UNIX_MAX_COMMAND_LENGTH;
}

/**
 * Handles a command array that may contain an {@link ExecArg}.
 * Returns a Promise if batching is needed, or `undefined` if the command
 * has no ExecArg and should be processed normally.
 *
 * @param parts - The command parts.
 * @param options - The exec options.
 * @returns A Promise if batching is handled, or `undefined`.
 */
function handleBatchedCommand(parts: CommandPart[], options: ExecOption): Promise<ExecResult | string> | undefined {
  const execArgs = parts.filter(isExecArg);
  if (execArgs.length === 0) {
    return undefined;
  }
  if (execArgs.length > 1) {
    return Promise.reject(new Error('Only one ExecArg with batchedArgs is allowed per command'));
  }

  const execArg = execArgs[0];
  assertNonNullable(execArg);
  const staticParts = parts.filter((part): part is string => typeof part === 'string');
  const baseCommand = toCommandLine(staticParts);
  const maxCommandLength = getMaxCommandLength();

  // Try expanding all args inline
  const fullCommand = `${baseCommand} ${execArg.batchedArgs.join(' ')}`;
  if (fullCommand.length <= maxCommandLength) {
    return execString(fullCommand, options);
  }

  // Split into batches
  const batches: string[][] = [];
  let currentBatch: string[] = [];

  for (const arg of execArg.batchedArgs) {
    const tentative = `${baseCommand} ${[...currentBatch, arg].join(' ')}`;
    if (tentative.length > maxCommandLength) {
      if (currentBatch.length === 0) {
        return Promise.reject(
          new Error(
            `Cannot split command into batches: a single argument (${String(arg.length)} chars) plus the base command (${
              String(baseCommand.length)
            } chars) exceeds the max command length (${String(maxCommandLength)}).`
          )
        );
      }
      batches.push(currentBatch);
      currentBatch = [arg];
    } else {
      currentBatch.push(arg);
    }
  }
  /* v8 ignore start -- Always true after the loop; batchedArgs is non-empty at this point. */
  if (currentBatch.length > 0) {
    /* v8 ignore stop */
    batches.push(currentBatch);
  }

  return executeBatches(baseCommand, batches, options);
}

/**
 * Checks if a command part is an {@link ExecArg}.
 *
 * @param part - The command part to check.
 * @returns Whether the part is an ExecArg.
 */
function isExecArg(part: CommandPart): part is ExecArg {
  return typeof part === 'object' && 'batchedArgs' in part;
}

/**
 * Spawns a child process via the appropriate shell.
 *
 * On Windows, if the command contains newlines (which `cmd.exe` cannot handle)
 * and the raw args array is available, spawns the process directly without
 * any shell — passing args via `CreateProcess`, which avoids all quoting issues.
 *
 * On Windows (cmd.exe path), applies `^`-escaping for cmd metacharacters.
 *
 * @param command - The command string to execute.
 * @param cwd - The working directory.
 * @param rawArgs - The original argument array (if available).
 * @returns The spawned child process.
 */
function spawnViaShell(command: string, cwd: string, rawArgs?: string[]): ChildProcessWithoutNullStreams {
  if (process.platform === 'win32' && command.includes('\n')) {
    if (!rawArgs) {
      throw new Error('Commands containing newlines cannot be executed through cmd.exe on Windows. Pass an argument array instead of a string.');
    }
    const [program, ...args] = rawArgs;
    assertNonNullable(program, 'Command array must not be empty');
    return spawn(program, args, {
      cwd,
      env: CHILD_ENV,
      stdio: 'pipe'
    });
  }

  const shellCommand = process.platform === 'win32' ? cmdEscapeCommandLine(command) : command;
  return spawn(shellCommand, [], {
    cwd,
    env: CHILD_ENV,
    shell: true,
    stdio: 'pipe'
  });
}
