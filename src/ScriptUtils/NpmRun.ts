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
  await execFromRoot(['npm', 'run', ...(isKnownCommand ? [] : ['obsidian-dev-utils']), command]);
}
