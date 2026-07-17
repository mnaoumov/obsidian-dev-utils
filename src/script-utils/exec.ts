/**
 * @file
 *
 * Contains utility functions for executing commands.
 */

import type { ChildProcess } from 'node:child_process';

import { spawn } from 'node:child_process';
import process from 'node:process';

import { getLibDebugger } from '../debug.ts';
import { normalizeOptionalProperties } from '../object-utils.ts';
import { trimEnd } from '../string.ts';
import { assertNonNullable } from '../type-guards.ts';
import {
  cmdEscapeCommandLine,
  toCommandLine,
  toPosixCommandLine
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
export interface ExecDetailedOptions extends ExecOptions {
  /**
   * Must be `true` to receive detailed results.
   */
  readonly shouldIncludeDetails: true;
}

/**
 * Options for executing a command.
 */
export interface ExecOptions {
  /**
   * A current working folder for the command execution.
   */
  readonly cwd?: string;

  /**
   * Additional environment variables for the child process, merged over the inherited environment.
   *
   * @default `{}`
   */
  readonly env?: NodeJS.ProcessEnv;

  /**
   * If `true`, attaches the child process's stdio directly to the terminal (`stdio: 'inherit'`) instead
   * of capturing it. Use for long-running or interactive commands such as dev servers and watch mode.
   * Because the output is not captured, the resolved stdout is an empty string.
   *
   * @default `false`
   */
  readonly isInteractive?: boolean;

  /**
   * If `true`, suppresses the output of the command.
   *
   * @default `false`
   */
  readonly isQuiet?: boolean;

  /**
   * If `true`, throws an error if the command fails.
   *
   * @default `true`
   */
  readonly shouldFailIfCalledFromOutsideRoot?: boolean;

  /**
   * If `true`, ignores the exit code of the command.
   *
   * @default `false`
   */
  readonly shouldIgnoreExitCode?: boolean;

  /**
   * If `false`, only returns the output of the command.
   *
   * @default `false`
   */
  readonly shouldIncludeDetails?: boolean;

  /**
   * An input to be passed to the command.
   *
   * @default `''`
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
export interface ExecSimpleOptions extends ExecOptions {
  /**
   * Must be `false` or omitted to receive only stdout.
   *
   * @default `false`
   */
  readonly shouldIncludeDetails?: false;
}

/**
 * Parameters for {@link execString}.
 */
interface ExecStringParams {
  /**
   * The command string.
   */
  readonly command: string;

  /**
   * The exec options.
   */
  readonly options?: ExecOptions;

  /**
   * The original argument array (if available), used by the PowerShell
   * fallback path to quote arguments with PowerShell-native single quotes.
   */
  readonly rawArgs?: string[];
}
/**
 * Appends a single `node` CLI option to a `NODE_OPTIONS` string, preserving any options already present.
 *
 * @param existingNodeOptions - The current `NODE_OPTIONS` value (e.g. `process.env.NODE_OPTIONS`), if any.
 * @param option - The `node` CLI option to append (e.g. `--localstorage-file=:memory:`).
 * @returns The combined `NODE_OPTIONS` string. If `option` is already present, the value is returned unchanged.
 */
export function appendNodeOption(existingNodeOptions: string | undefined, option: string): string {
  const trimmed = (existingNodeOptions ?? '').trim();
  if (trimmed === '') {
    return option;
  }
  if (trimmed.split(/\s+/).includes(option)) {
    return trimmed;
  }
  return `${trimmed} ${option}`;
}

/**
 * Builds the environment for child processes: the parent environment plus `DEBUG_COLORS`, and — when
 * the running `node` supports it — {@link LOCAL_STORAGE_NODE_OPTION} appended to `NODE_OPTIONS`.
 *
 * The support check guards against older `node` (< 22): passing an option `node` does not recognize via
 * `NODE_OPTIONS` makes it exit before running, which would break every spawned tool.
 *
 * @param baseEnv - The parent environment to extend (typically `process.env`).
 * @param allowedNodeEnvironmentFlags - The `node` options accepted via `NODE_OPTIONS` (typically `process.allowedNodeEnvironmentFlags`).
 * @returns The environment to pass to spawned child processes.
 */
export function buildChildEnv(baseEnv: NodeJS.ProcessEnv, allowedNodeEnvironmentFlags: ReadonlySet<string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    DEBUG_COLORS: '1',
    ...baseEnv
  };
  if (allowedNodeEnvironmentFlags.has('--localstorage-file')) {
    env['NODE_OPTIONS'] = appendNodeOption(baseEnv['NODE_OPTIONS'], LOCAL_STORAGE_NODE_OPTION);
  }
  return env;
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
export function exec(command: CommandPart[] | string, options: ExecOptions = {}): Promise<ExecResult | string> {
  if (Array.isArray(command)) {
    const batchResult = handleBatchedCommand(command, options);
    if (batchResult) {
      return batchResult;
    }
    const args = command.filter((part): part is string => typeof part === 'string');
    const commandLine = buildCommandLine(args);

    const maxCommandLength = getMaxCommandLength();
    if (commandLine.length > maxCommandLength) {
      return Promise.reject(
        new Error(
          `Command line is too long (${String(commandLine.length)} chars, max ${String(maxCommandLength)} on ${process.platform}). Consider splitting into smaller batches or use ExecArg.`
        )
      );
    }

    return execString({
      command: commandLine,
      options,
      rawArgs: args
    });
  }

  const maxCommandLength = getMaxCommandLength();
  if (command.length > maxCommandLength) {
    return Promise.reject(
      new Error(
        `Command line is too long (${String(command.length)} chars, max ${String(maxCommandLength)} on ${process.platform}). Consider splitting into smaller batches or use ExecArg.`
      )
    );
  }

  return execString({
    command,
    options
  });
}

/**
 * Executes a single string command.
 *
 * @param params - The parameters for the execution.
 * @returns A Promise resolving to the result.
 */
function execString(params: ExecStringParams): Promise<ExecResult | string> {
  const {
    command,
    options = {},
    rawArgs
  } = params;
  const {
    cwd = process.cwd(),
    env,
    isInteractive = false,
    isQuiet: quiet = false,
    shouldIgnoreExitCode: ignoreExitCode = false,
    shouldIncludeDetails = false,
    stdin = ''
  } = options;

  return new Promise((resolve, reject) => {
    getLibDebugger('Exec')(`Executing command: ${command}`);

    const child = spawnViaShell(normalizeOptionalProperties<SpawnViaShellParams>({
      command,
      cwd,
      env,
      isInteractive,
      rawArgs
    }));

    let stdout = '';
    let stderr = '';

    // In interactive mode the child's stdio is inherited by the terminal, so there are no streams to read and nothing is captured.
    if (!isInteractive) {
      const {
        stderr: childStderr,
        stdin: childStdin,
        stdout: childStdout
      } = child;
      assertNonNullable(childStdin, 'Child process stdin is not available');
      assertNonNullable(childStdout, 'Child process stdout is not available');
      assertNonNullable(childStderr, 'Child process stderr is not available');

      childStdin.write(stdin);
      childStdin.end();

      childStdout.on('data', (data: Buffer) => {
        if (!quiet) {
          process.stdout.write(data);
        }
        stdout += data.toString('utf-8');
      });

      childStdout.on('end', () => {
        stdout = trimEnd({
          str: stdout,
          suffix: '\n'
        });
      });

      childStderr.on('data', (data: Buffer) => {
        if (!quiet) {
          process.stderr.write(data);
        }
        stderr += data.toString('utf-8');
      });

      childStderr.on('end', () => {
        stderr = trimEnd({
          str: stderr,
          suffix: '\n'
        });
      });
    }

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
 * A `node` CLI option (passed via `NODE_OPTIONS`) that provides an in-memory `localStorage` to every
 * spawned `node` process. Node 22+ exposes an experimental Web Storage `localStorage`, but accessing it
 * without `--localstorage-file` emits an `ExperimentalWarning` and leaves `localStorage` unavailable.
 * Pointing it at the special `:memory:` database gives each process a working, non-persistent
 * `localStorage` (no file on disk, no state shared between processes) — matching the real Obsidian
 * (Electron) runtime and silencing the warning by addressing its root cause rather than suppressing it.
 *
 * It is applied only when the running `node` actually supports it (see {@link buildChildEnv}): passing
 * an option `node` does not recognize via `NODE_OPTIONS` makes it refuse to start, so an older `node`
 * (< 22) must be left untouched.
 */
const LOCAL_STORAGE_NODE_OPTION = '--localstorage-file=:memory:';

/**
 * Default environment variables passed to child processes.
 */
const CHILD_ENV = buildChildEnv(process.env, process.allowedNodeEnvironmentFlags);

/**
 * Parameters for {@link executeBatches}.
 */
interface ExecuteBatchesParams {
  /**
   * The base command without batched args.
   */
  readonly baseCommand: string;

  /**
   * The batches of args.
   */
  readonly batches: string[][];

  /**
   * The exec options.
   */
  readonly options: ExecOptions;
}

/**
 * Parameters for {@link spawnViaShell}.
 */
interface SpawnViaShellParams {
  /**
   * The command string to execute.
   */
  readonly command: string;

  /**
   * The working directory.
   */
  readonly cwd: string;

  /**
   * Additional environment variables merged over the inherited child environment.
   */
  readonly env?: NodeJS.ProcessEnv;

  /**
   * If `true`, attaches the child's stdio to the terminal instead of piping it.
   */
  readonly isInteractive?: boolean;

  /**
   * The original argument array (if available).
   */
  readonly rawArgs?: string[];
}

/**
 * Builds a command-line string from an argument array, quoted for the shell that
 * {@link spawnViaShell} will route through on the current platform.
 *
 * On Windows the command is executed via `cmd.exe`, so it uses the
 * `CommandLineToArgvW` convention ({@link toCommandLine}); {@link spawnViaShell}
 * then applies {@link cmdEscapeCommandLine} on top for `cmd.exe` metacharacters.
 * Elsewhere the command is executed via `sh -c`, so it uses POSIX single-quote
 * quoting ({@link toPosixCommandLine}) and needs no further escaping.
 *
 * The platform branch here MUST stay in sync with the one in {@link spawnViaShell}.
 *
 * @param args - The argument array to quote and join.
 * @returns The quoted command-line string for the current platform's shell.
 */
function buildCommandLine(args: string[]): string {
  return process.platform === 'win32' ? toCommandLine(args) : toPosixCommandLine(args);
}

/**
 * Executes batched commands sequentially and concatenates stdout.
 *
 * @param params - The parameters for the batched execution.
 * @returns A Promise resolving to the concatenated result.
 */
async function executeBatches(params: ExecuteBatchesParams): Promise<ExecResult | string> {
  const { baseCommand, batches, options } = params;
  const results: string[] = [];

  for (const batch of batches) {
    const batchCommand = `${baseCommand} ${buildCommandLine(batch)}`;
    const result = await execString({
      command: batchCommand,
      options
    });
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
function handleBatchedCommand(parts: CommandPart[], options: ExecOptions): Promise<ExecResult | string> | undefined {
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
  const baseCommand = buildCommandLine(staticParts);
  const maxCommandLength = getMaxCommandLength();

  // Try expanding all args inline
  const fullCommand = `${baseCommand} ${buildCommandLine([...execArg.batchedArgs])}`;
  if (fullCommand.length <= maxCommandLength) {
    return execString({
      command: fullCommand,
      options
    });
  }

  // Split into batches
  const batches: string[][] = [];
  let currentBatch: string[] = [];

  for (const arg of execArg.batchedArgs) {
    const tentative = `${baseCommand} ${buildCommandLine([...currentBatch, arg])}`;
    if (tentative.length > maxCommandLength) {
      if (currentBatch.length === 0) {
        return Promise.reject(
          new Error(
            `Cannot split command into batches: a single argument (${String(arg.length)} chars) plus the base command (${String(baseCommand.length)} chars) exceeds the max command length (${String(maxCommandLength)}).`
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

  return executeBatches({
    baseCommand,
    batches,
    options
  });
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
 * @param params - The parameters for spawning the child process.
 * @returns The spawned child process.
 */
function spawnViaShell(params: SpawnViaShellParams): ChildProcess {
  const { command, cwd, env: extraEnv, isInteractive = false, rawArgs } = params;
  const env: NodeJS.ProcessEnv = {
    ...CHILD_ENV,
    ...extraEnv
  };
  const stdio: 'inherit' | 'pipe' = isInteractive ? 'inherit' : 'pipe';
  if (process.platform === 'win32' && command.includes('\n')) {
    if (!rawArgs) {
      throw new Error('Commands containing newlines cannot be executed through cmd.exe on Windows. Pass an argument array instead of a string.');
    }
    const [program, ...args] = rawArgs;
    assertNonNullable(program, 'Command array must not be empty');
    return spawn(program, args, {
      cwd,
      env,
      stdio
    });
  }

  const shellCommand = process.platform === 'win32' ? cmdEscapeCommandLine(command) : command;
  return spawn(shellCommand, [], {
    cwd,
    env,
    shell: true,
    stdio
  });
}
