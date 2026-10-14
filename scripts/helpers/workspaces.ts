/**
 * @file
 *
 * The workspace packages of this repository, in dependency order, and a runner that runs one npm script in each.
 */

import { readPackageJson } from '@mnaoumov/typescript-dev-toolkit/npm';
import { getPackageManagerRunCommand } from '@mnaoumov/typescript-dev-toolkit/package-manager';
import { execFromRoot } from '@mnaoumov/typescript-dev-toolkit/root';

/**
 * Options for {@link runInWorkspaces}.
 */
export interface RunInWorkspacesOptions {
  /**
   * Extra arguments forwarded to the script after `--`.
   */
  readonly scriptArguments?: readonly string[];
}

/**
 * Returns the workspace folders the root `package.json` lists, in the order it lists them. The order is the
 * dependency order, so a package is always built after the packages it imports.
 *
 * @returns The workspace folders, relative to the repository root.
 */
export async function getWorkspaceFolders(): Promise<string[]> {
  const packageJson = await readPackageJson();
  const workspaces = packageJson.workspaces;
  if (!Array.isArray(workspaces)) {
    throw new TypeError('The root package.json lists no workspaces.');
  }
  return workspaces;
}

/**
 * Runs an npm script in every workspace package that defines it, one after another in dependency order.
 *
 * @param script - The script to run.
 * @param options - The {@link RunInWorkspacesOptions}.
 * @returns The workspace folders the script ran in.
 */
export async function runInWorkspaces(script: string, options: RunInWorkspacesOptions = {}): Promise<string[]> {
  const ranIn: string[] = [];
  for (const folder of await getWorkspaceFolders()) {
    const packageJson = await readPackageJson(folder);
    if (!Object.keys(packageJson.scripts ?? {}).includes(script)) {
      continue;
    }
    const scriptArguments = options.scriptArguments ?? [];
    await execFromRoot(
      [...getPackageManagerRunCommand(), script, ...(scriptArguments.length > 0 ? ['--', ...scriptArguments] : [])],
      { cwd: folder }
    );
    ranIn.push(folder);
  }
  return ranIn;
}
