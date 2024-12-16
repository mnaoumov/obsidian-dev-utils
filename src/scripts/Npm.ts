/**
 * @packageDocumentation Npm
 * Contains utility functions for NPM package.json.
 */

import type { PackageJson } from 'type-fest';

import type { MaybePromise } from '../Async.ts';

import { throwExpression } from '../Error.ts';
import { ObsidianPluginRepoPaths } from '../obsidian/Plugin/ObsidianPluginRepoPaths.ts';
import {
  editJson,
  readJson,
  writeJson
} from './JSON.ts';
import { resolvePathFromRoot } from './Root.ts';

/**
 * Options for editing a package.json file.
 */
export interface EditPackageJsonOptions {
  /**
   * The current working directory where `package.json` is located.
   */
  cwd?: string | undefined;

  /**
   * If true, skips editing if the file does not exist.
   */
  shouldSkipIfMissing?: boolean | undefined;
}

/**
 * The type of the `package.json` file.
 */
export type { PackageJson };

/**
 * The type of the `package-lock.json` file.
 */
export interface PackageLockJson extends Partial<PackageJson> {
  /**
   * The packages in the `package-lock.json` file.
   */
  packages?: Record<string, PackageJson>;
}

/**
 * Reads, edits, and writes back the `package.json` file using the provided edit function.
 *
 * @param editFn - The function to edit the parsed `PackageJson` object.
 * @param options - Additional options for editing.
 * @returns A promise that resolves when the file has been edited and written.
 */
export async function editPackageJson(
  editFn: (packageJson: PackageJson) => MaybePromise<void>, options: EditPackageJsonOptions = {}): Promise<void> {
  const {
    cwd,
    shouldSkipIfMissing
  } = options;
  await editJson<PackageJson>(getPackageJsonPath(cwd), editFn, { shouldSkipIfMissing });
}

/**
 * Reads, edits, and writes back the `package-lock.json` file using the provided edit function.
 *
 * @param editFn - The function to edit the parsed `PackageJson` object.
 * @param options - Additional options for editing.
 * @returns A promise that resolves when the file has been edited and written.
 */
export async function editPackageLockJson(
  editFn: (PackageLockJson: PackageLockJson) => MaybePromise<void>,
  options: EditPackageJsonOptions = {}): Promise<void> {
  const {
    cwd,
    shouldSkipIfMissing
  } = options;
  await editJson<PackageJson>(getPackageLockJsonPath(cwd), editFn, { shouldSkipIfMissing });
}

/**
 * Resolves the path to the `package.json` file in the specified directory or in the root if no directory is specified.
 *
 * @param cwd - The current working directory where `package.json` is located.
 * @returns The resolved path to the `package.json` file.
 */
export function getPackageJsonPath(cwd?: string): string {
  return resolvePathFromRoot(ObsidianPluginRepoPaths.PackageJson, cwd) ?? throwExpression(new Error('Could not determine the package.json path'));
}

/**
 * Resolves the path to the `package-lock.json` file in the specified directory or in the root if no directory is specified.
 *
 * @param cwd - The current working directory where `package-lock.json` is located.
 * @returns The resolved path to the `package-lock.json` file.
 */
export function getPackageLockJsonPath(cwd?: string): string {
  return resolvePathFromRoot(ObsidianPluginRepoPaths.PackageLockJson, cwd) ?? throwExpression(new Error('Could not determine the package-lock.json path'));
}

/**
 * Reads the `package.json` file from the specified directory or from the root if no directory is specified.
 *
 * @param cwd - The current working directory where `package.json` is located.
 * @returns A promise that resolves with the parsed `PackageJson` object.
 */
export async function readPackageJson(cwd?: string): Promise<PackageJson> {
  return await readJson<PackageJson>(getPackageJsonPath(cwd));
}

/**
 * Reads the `package-lock.json` file from the specified directory or from the root if no directory is specified.
 *
 * @param cwd - The current working directory where `package-lock.json` is located.
 * @returns A promise that resolves with the parsed `PackageJson` object.
 */
export async function readPackageLockJson(cwd?: string): Promise<PackageLockJson> {
  return await readJson<PackageLockJson>(getPackageLockJsonPath(cwd));
}

/**
 * Writes the provided `PackageJson` object to the `package.json` file in the specified directory or in the root.
 *
 * @param packageJson - The `PackageJson` object to write.
 * @param cwd - The current working directory where `package.json` is located.
 * @returns A promise that resolves when the file has been written.
 */
export async function writePackageJson(packageJson: PackageJson, cwd?: string): Promise<void> {
  await writeJson(getPackageJsonPath(cwd), packageJson);
}

/**
 * Writes the provided `PackageJson` object to the `package-lock.json` file in the specified directory or in the root.
 *
 * @param packageLockJson - The `PackageLockJson` object to write.
 * @param cwd - The current working directory where `package-lock.json` is located.
 * @returns A promise that resolves when the file has been written.
 */
export async function writePackageLockJson(packageLockJson: PackageLockJson, cwd?: string): Promise<void> {
  await writeJson(getPackageLockJsonPath(cwd), packageLockJson);
}
