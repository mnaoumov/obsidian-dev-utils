/**
 * @file
 *
 * NPM run utilities.
 */

import { getLibDebugger } from '../debug.ts';
import { readPackageJson } from './npm.ts';
import { execFromRoot } from './root.ts';

/**
 * The result of running an optional npm command.
 */
export enum NpmRunOptionalResult {
  /**
   * The command was skipped because it was not defined in the package.json scripts.
   */
  Skipped = 'skipped',

  /**
   * The command was found and run successfully.
   */
  Success = 'success'
}

/**
 * Runs a command using npm checking if the command is overridden in the package.json.
 *
 * @param command - The command to run.
 */
export async function npmRun(command: string): Promise<void> {
  const packageJson = await readPackageJson();
  const isKnownCommand = Object.keys(packageJson.scripts ?? {}).includes(command);
  if (isKnownCommand) {
    await execFromRoot(['npm', 'run', command]);
  } else {
    throw new Error(`Command ${command} is not defined in the package.json`);
  }
}

/**
 * Runs a command using npm only if the command is defined in the package.json scripts.
 * If the command is not defined, it is silently skipped.
 *
 * @param command - The command to run.
 * @returns A {@link Promise} that resolves to {@link NpmRunOptionalResult.Success} if the command was
 * found and run, or {@link NpmRunOptionalResult.Skipped} otherwise.
 */
export async function npmRunOptional(command: string): Promise<NpmRunOptionalResult> {
  const packageJson = await readPackageJson();
  const isKnownCommand = Object.keys(packageJson.scripts ?? {}).includes(command);
  if (isKnownCommand) {
    await execFromRoot(['npm', 'run', command]);
    return NpmRunOptionalResult.Success;
  }
  getLibDebugger('npmRunOptional')(`Command ${command} is not defined in the package.json, skipping`);
  return NpmRunOptionalResult.Skipped;
}
