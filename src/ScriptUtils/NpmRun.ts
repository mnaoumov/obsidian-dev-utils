/**
 * @packageDocumentation
 *
 * NPM run utilities.
 */

import { readPackageJson } from './Npm.ts';
import { execFromRoot } from './Root.ts';

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
    await execFromRoot(['npx', 'obsidian-dev-utils', command]);
  }
}

/**
 * Runs a command using npm only if the command is defined in the package.json scripts.
 * If the command is not defined, it is silently skipped.
 *
 * @param command - The command to run.
 */
export async function npmRunOptional(command: string): Promise<void> {
  const packageJson = await readPackageJson();
  const isKnownCommand = Object.keys(packageJson.scripts ?? {}).includes(command);
  if (isKnownCommand) {
    await execFromRoot(['npm', 'run', command]);
  }
}
