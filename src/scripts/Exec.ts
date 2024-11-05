import { trimEnd } from '../String.ts';
import { toCommandLine } from './CliUtils.ts';
import {
  process,
  spawn
} from './NodeModules.ts';

/**
 * Represents the result of executing a command.
 */
export interface ExecResult {
  /**
   * The exit code of the command. A value of `null` indicates that the process did not exit normally.
   */
  exitCode: number | null;

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
 * Options for executing a command.
 */
export interface ExecOption {
  /**
   * If true, suppresses the output of the command.
   */
  quiet?: boolean;

  /**
   * If true, ignores the exit code of the command.
   */
  ignoreExitCode?: boolean;

  /**
   * The input to be passed to the command.
   */
  stdin?: string;

  /**
   * The current working directory for the command execution.
   */
  cwd?: string | undefined;

  /**
   * If false, only returns the output of the command.
   */
  withDetails?: boolean;
}

/**
 * Executes a command.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @returns A Promise that resolves with the output of the command.
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is false.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is true,
 *         the error is resolved with the stdout and stderr.
 */
export async function exec(command: string | string[], options?: ExecOption & { withDetails?: false }): Promise<string>;

/**
 * Executes a command.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @returns A Promise that resolves with ExecResult object.
 *          The ExecResult object contains the exit code, exit signal, stderr, and stdout.
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is false.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is true,
 *         the error is resolved with the stdout and stderr.
 */
export function exec(command: string | string[], options: ExecOption & { withDetails: true }): Promise<ExecResult>;

/**
 * Executes a command.
 *
 * @param command - The command to execute. It can be a string or an array of strings.
 * @param options - The options for the execution.
 * @returns A Promise that resolves with the output of the command or an ExecResult object.
 *          The ExecResult object contains the exit code, exit signal, stderr, and stdout.
 * @throws If the command fails with a non-zero exit code and ignoreExitCode is false.
 *         The error message includes the exit code and stderr.
 *         If an error occurs during the execution and ignoreExitCode is true,
 *         the error is resolved with the stdout and stderr.
 */
export function exec(command: string | string[], options: ExecOption = {}): Promise<string | ExecResult> {
  const {
    quiet = false,
    ignoreExitCode = false,
    stdin = '',
    cwd = process.cwd(),
    withDetails = false
  } = options;
  if (Array.isArray(command)) {
    command = toCommandLine(command);
  }

  return new Promise((resolve, reject) => {
    console.log(`Executing command: ${command}`);
    const [cmd = '', ...args] = command.split(' ');

    const child = spawn(cmd, args, {
      cwd,
      stdio: 'pipe',
      shell: true
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
      } else {
        let result: string | ExecResult;
        if (!withDetails) {
          result = stdout;
        } else {
          result = {
            exitCode,
            exitSignal,
            stderr,
            stdout
          };
        }
        resolve(result);
      }
    });

    child.on('error', (err) => {
      if (!ignoreExitCode) {
        reject(err);
      } else {
        let result: string | ExecResult;
        if (!withDetails) {
          result = stdout;
        } else {
          result = {
            exitCode: null,
            exitSignal: null,
            stderr,
            stdout
          };
        }
        resolve(result);
      }
    });
  });
}