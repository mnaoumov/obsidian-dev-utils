/**
 * @packageDocumentation
 *
 * Contains utility functions for executing commands.
 */

import { getLibDebugger } from '../Debug.ts';
import { trimEnd } from '../String.ts';
import { toCommandLine } from './CliUtils.ts';
import {
  process,
  spawn
} from './NodeModules.ts';

/**
 * Options for executing a command.
 */
export interface ExecOption {
  /**
   * The current working folder for the command execution.
   */
  cwd?: string;

  /**
   * If true, suppresses the output of the command.
   */
  isQuiet?: boolean;

  /**
   * If true, throws an error if the command fails.
   */
  shouldFailIfCalledFromOutsideRoot?: boolean;

  /**
   * If true, ignores the exit code of the command.
   */
  shouldIgnoreExitCode?: boolean;

  /**
   * If false, only returns the output of the command.
   */
  shouldIncludeDetails?: boolean;

  /**
   * The input to be passed to the command.
   */
  stdin?: string;
}

/**
 * Represents the result of executing a command.
 */
export interface ExecResult {
  /**
   * The exit code of the command. A value of `null` indicates that the process did not exit normally.
   */
  exitCode: null | number;

  /**
   * The signal that caused the process to be terminated. A value of `null` indicates that no signal was received.
   */
  exitSignal: NodeJS.Signals | null;

  /**
   * The standard error output from the command.
   */
  stderr: string;

  /**
   * The standard output from the command.
   */
  stdout: string;
}

/**
 * Executes a command.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @returns A {@link Promise} that resolves with the output of the command.
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is false.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is true,
 *         the error is resolved with the stdout and stderr.
 */
export async function exec(command: string | string[], options?: { withDetails?: false } & ExecOption): Promise<string>;

/**
 * Executes a command.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @returns A {@link Promise} that resolves with ExecResult object.
 *          The ExecResult object contains the exit code, exit signal, stderr, and stdout.
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is false.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is true,
 *         the error is resolved with the stdout and stderr.
 */
export function exec(command: string | string[], options: { withDetails: true } & ExecOption): Promise<ExecResult>;

/**
 * Executes a command.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @returns A {@link Promise} that resolves with the output of the command or an ExecResult object.
 *          The ExecResult object contains the exit code, exit signal, stderr, and stdout.
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is false.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is true,
 *         the error is resolved with the stdout and stderr.
 */
export function exec(command: string | string[], options: ExecOption = {}): Promise<ExecResult | string> {
  const {
    cwd = process.cwd(),
    isQuiet: quiet = false,
    shouldIgnoreExitCode: ignoreExitCode = false,
    shouldIncludeDetails: withDetails = false,
    stdin = ''
  } = options;
  if (Array.isArray(command)) {
    command = toCommandLine(command);
  }

  return new Promise((resolve, reject) => {
    getLibDebugger('Exec')(`Executing command: ${command}`);

    const child = spawn(command, [], {
      cwd,
      env: {
        DEBUG_COLORS: '1',
        ...process.env
      },
      shell: true,
      stdio: 'pipe'
    });

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
        reject(new Error(`Command failed with exit code ${exitCode?.toString() ?? '(null)'}\n${stderr}`));
        return;
      }

      if (!withDetails) {
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

      if (!withDetails) {
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
