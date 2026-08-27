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
  cmdEscapeCommandLine as commandEscapeCommandLine,
  toCommandLine,
  toPosixCommandLine
} from './cli-utils.ts';

/**
 * A command part: either a plain string or an {@link ExecArgument} with batched arguments.
 */
export type CommandPart = ExecArgument | string;

/**
 * A command argument that contains a list of args to be batched.
 * If the expanded command exceeds the platform's max command length,
 * the batched args are split into sequential executions.
 */
export interface ExecArgument {
  /**
   * The arguments to batch.
   */
  readonly batchedArguments: readonly string[];
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
  readonly rawArguments?: string[];
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
    const $arguments = command.filter((part): part is string => typeof part === 'string');
    const commandLine = buildCommandLine($arguments);

    const maxCommandLength = getMaxCommandLength();
    const effectiveLength = getEffectiveCommandLineLength(commandLine);
    if (effectiveLength > maxCommandLength) {
      return Promise.reject(
        new Error(
          `Command line is too long (${String(effectiveLength)} chars once wrapped for the shell, max ${String(maxCommandLength)} on ${process.platform}). Consider splitting into smaller batches or use ExecArg.`
        )
      );
    }

    return execString({
      command: commandLine,
      options,
      rawArguments: $arguments
    });
  }

  const maxCommandLength = getMaxCommandLength();
  const effectiveLength = getEffectiveCommandLineLength(command);
  if (effectiveLength > maxCommandLength) {
    return Promise.reject(
      new Error(
        `Command line is too long (${String(effectiveLength)} chars once wrapped for the shell, max ${String(maxCommandLength)} on ${process.platform}). Consider splitting into smaller batches or use ExecArg.`
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
    rawArguments
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
      rawArguments
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
          $string: stdout,
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
          $string: stderr,
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

    child.on('error', (error) => {
      if (!ignoreExitCode) {
        reject(error);
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
 * Characters held back from the Windows command-line budget when sizing an {@link ExecArgument} batch, to
 * cover expansions that happen INSIDE the command we spawn and are therefore invisible from here.
 *
 * A `npx <tool> <args…>` invocation is not one `cmd.exe` command line but a chain of them: `npx.cmd`
 * re-expands `%*` into a fresh `node … npx-cli.js <args…>` line, the tool's own `.bin/<tool>.cmd` shim does
 * it again, and each hop re-quotes what it forwards. Every one of those lines is subject to the same 8191
 * limit, and every one is longer than the line we assembled — but by how much is the child's business, not
 * ours, so no formula can be right. Only the deliberate slack below can.
 *
 * `2048` is roughly double the overhead measured when this was found (T635). Over a repository's 187
 * markdown paths, a `npx markdownlint-cli2 …` line **assembled at 7051 chars** — 1140 under the limit —
 * still died with `The command line is too long.`; the same payload split in two runs clean. Note the tool:
 * this is not specific to `linkinator`, it is the shape of every `npx`-fronted invocation.
 *
 * Over-reserving costs one extra sequential invocation of a command that was already going to be batched;
 * under-reserving costs a lint failure that names nothing wrong with the content. Raise it, never lower it,
 * if the symptom returns.
 */
const WINDOWS_CHILD_EXPANSION_RESERVE = 2048;

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
  readonly rawArguments?: string[];
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
 * @param $arguments - The argument array to quote and join.
 * @returns The quoted command-line string for the current platform's shell.
 */
function buildCommandLine($arguments: string[]): string {
  return process.platform === 'win32' ? toCommandLine($arguments) : toPosixCommandLine($arguments);
}

/**
 * Executes batched commands sequentially and concatenates their output.
 *
 * `execString` returns a `string` or an {@link ExecResult} depending on `options.shouldIncludeDetails`, so
 * both shapes are unpacked — reading only the `string` one silently threw away every batch's output in
 * exactly the mode that asked for it.
 *
 * A batch that exits non-zero normally rejects; it only reaches here when `shouldIgnoreExitCode` asked for
 * it to be reported instead. The first such failure is what the aggregate reports, so splitting a command
 * into batches cannot turn a failure into a success.
 *
 * Silent batches contribute nothing to the joined output. `execString` already trims each result's trailing
 * newline, so joining empty ones back in would reintroduce exactly the blank-line noise it removed — a
 * command that printed nothing must aggregate to `''`, not to a run of newlines.
 *
 * @param params - The parameters for the batched execution.
 * @returns A Promise resolving to the concatenated result.
 */
async function executeBatches(params: ExecuteBatchesParams): Promise<ExecResult | string> {
  const { baseCommand, batches, options } = params;
  const stdoutParts: string[] = [];
  const stderrParts: string[] = [];
  let failure: ExecResult | null = null;

  for (const batch of batches) {
    const batchCommand = `${baseCommand} ${buildCommandLine(batch)}`;
    const result = await execString({
      command: batchCommand,
      options
    });
    if (typeof result === 'string') {
      pushIfNotEmpty(stdoutParts, result);
      continue;
    }

    pushIfNotEmpty(stdoutParts, result.stdout);
    pushIfNotEmpty(stderrParts, result.stderr);
    failure ??= result.exitCode === 0 ? null : result;
  }

  if (options.shouldIncludeDetails) {
    return {
      exitCode: failure?.exitCode ?? 0,
      exitSignal: failure?.exitSignal ?? null,
      stderr: stderrParts.join('\n'),
      stdout: stdoutParts.join('\n')
    };
  }

  return stdoutParts.join('\n');
}

/**
 * Default environment variables passed to child processes, resolved at spawn time.
 *
 * Deliberately not a module-level constant. `.env` is loaded by `loadEnvFileIfExists` from inside
 * `wrapCliTask`, and ESM evaluates every import before the entry module's first statement — so a
 * snapshot taken here would always predate the load, and every spawned child would run without the
 * repo's own `.env`. Nothing surfaced that while Vitest 3 copied the `.env` it loaded into the
 * worker's `process.env`; Vitest 4 writes those to `import.meta.env` only, leaving this the sole
 * path and an empty one.
 *
 * @returns The environment to pass to spawned child processes, reflecting `process.env` as it stands now.
 */
function getChildEnv(): NodeJS.ProcessEnv {
  return buildChildEnv(process.env, process.allowedNodeEnvironmentFlags);
}

/**
 * Returns the length of the command line as the operating system will actually see it, which on Windows is
 * NOT the length of the string passed in.
 *
 * {@link spawnViaShell} routes the command through `cmd.exe`, and two things are spent between here and
 * there, neither of them visible in the assembled command:
 * - Node's `spawn(…, { shell: true })` wraps it as `<comspec> /d /s /c "<command>"`.
 * - {@link cmdEscapeCommandLine} `^`-escapes every one of `cmd.exe`'s metacharacters, which on a list of
 *   quoted paths is a few percent of the whole (measured: +236 chars on a 7216-char invocation).
 *
 * Both are ours to compute, so they are computed rather than guessed. What is NOT computable from here is
 * what the spawned command does to its own arguments — see {@link WINDOWS_CHILD_EXPANSION_RESERVE}.
 *
 * The platform branch here MUST stay in sync with the one in {@link spawnViaShell}.
 *
 * @param commandLine - The assembled command line, before any shell wrapping.
 * @returns The length in characters of what reaches the operating system.
 */
function getEffectiveCommandLineLength(commandLine: string): number {
  if (process.platform !== 'win32') {
    return commandLine.length;
  }

  const comspec = process.env['comspec'] ?? 'cmd.exe';
  const CMD_WRAPPER = ' /d /s /c ""';
  return comspec.length + CMD_WRAPPER.length + commandEscapeCommandLine(commandLine).length;
}

/**
 * Returns the max command line length to size an {@link ExecArgument} batch against — the platform maximum
 * less {@link WINDOWS_CHILD_EXPANSION_RESERVE}.
 *
 * Deliberately more conservative than {@link getMaxCommandLength}, because the two answer different
 * questions. Exceeding the plain-command limit is a hard failure the caller cannot avoid, so that check
 * stays exact. Exceeding the batching limit only costs one extra invocation, so that check may — and
 * should — leave room to spare.
 *
 * @returns The max length in characters available to a single batch.
 */
function getMaxBatchCommandLength(): number {
  return getMaxCommandLength() - (process.platform === 'win32' ? WINDOWS_CHILD_EXPANSION_RESERVE : 0);
}

/**
 * Returns the platform-specific max command line length.
 *
 * @returns The max command length in characters.
 */
function getMaxCommandLength(): number {
  const WINDOWS_MAX_COMMAND_LENGTH = 8191;
  const UNIX_MAX_COMMAND_LENGTH = 131_072;
  return process.platform === 'win32' ? WINDOWS_MAX_COMMAND_LENGTH : UNIX_MAX_COMMAND_LENGTH;
}

/**
 * Handles a command array that may contain an {@link ExecArgument}.
 * Returns a Promise if batching is needed, or `undefined` if the command
 * has no ExecArg and should be processed normally.
 *
 * @param parts - The command parts.
 * @param options - The exec options.
 * @returns A Promise if batching is handled, or `undefined`.
 */
function handleBatchedCommand(parts: CommandPart[], options: ExecOptions): Promise<ExecResult | string> | undefined {
  const execArguments = parts.filter(isExecArgument);
  if (execArguments.length === 0) {
    return undefined;
  }
  if (execArguments.length > 1) {
    return Promise.reject(new Error('Only one ExecArg with batchedArguments is allowed per command'));
  }

  const execArgument = execArguments[0];
  assertNonNullable(execArgument);
  const staticParts = parts.filter((part): part is string => typeof part === 'string');
  const baseCommand = buildCommandLine(staticParts);
  const maxCommandLength = getMaxBatchCommandLength();

  // Try expanding all args inline
  const fullCommand = `${baseCommand} ${buildCommandLine([...execArgument.batchedArguments])}`;
  if (getEffectiveCommandLineLength(fullCommand) <= maxCommandLength) {
    return execString({
      command: fullCommand,
      options
    });
  }

  // Split into batches
  const batches: string[][] = [];
  let currentBatch: string[] = [];

  for (const argument of execArgument.batchedArguments) {
    const tentative = `${baseCommand} ${buildCommandLine([...currentBatch, argument])}`;
    if (getEffectiveCommandLineLength(tentative) > maxCommandLength) {
      if (currentBatch.length === 0) {
        return Promise.reject(
          new Error(
            `Cannot split command into batches: a single argument (${String(argument.length)} chars) plus the base command (${String(baseCommand.length)} chars) exceeds the max batch command length (${String(maxCommandLength)}).`
          )
        );
      }
      batches.push(currentBatch);
      currentBatch = [argument];
    } else {
      currentBatch.push(argument);
    }
  }
  /* v8 ignore start -- Always true after the loop; batchedArguments is non-empty at this point. */
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
 * Checks if a command part is an {@link ExecArgument}.
 *
 * @param part - The command part to check.
 * @returns Whether the part is an ExecArg.
 */
function isExecArgument(part: CommandPart): part is ExecArgument {
  return typeof part === 'object' && 'batchedArguments' in part;
}

/**
 * Appends a batch's captured output to the accumulator, skipping an empty one so the eventual join does not
 * fabricate blank lines for batches that printed nothing.
 *
 * @param accumulator - The collected outputs so far.
 * @param output - The output of a single batch.
 */
function pushIfNotEmpty(accumulator: string[], output: string): void {
  if (output !== '') {
    accumulator.push(output);
  }
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
  const { command, cwd, env: extraEnv, isInteractive = false, rawArguments } = params;
  const env: NodeJS.ProcessEnv = {
    ...getChildEnv(),
    ...extraEnv
  };
  const stdio: 'inherit' | 'pipe' = isInteractive ? 'inherit' : 'pipe';
  if (process.platform === 'win32' && command.includes('\n')) {
    if (!rawArguments) {
      throw new Error('Commands containing newlines cannot be executed through cmd.exe on Windows. Pass an argument array instead of a string.');
    }
    const [program, ...$arguments] = rawArguments;
    assertNonNullable(program, 'Command array must not be empty');
    return spawn(program, $arguments, {
      cwd,
      env,
      stdio
    });
  }

  const shellCommand = process.platform === 'win32' ? commandEscapeCommandLine(command) : command;
  return spawn(shellCommand, [], {
    cwd,
    env,
    shell: true,
    stdio
  });
}
