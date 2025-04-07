/**
 * @packageDocumentation
 *
 * Contains utility functions for NPM package.json.
 */

import type {
  PackageJson,
  Promisable
} from 'type-fest';

import type { EditJsonOptions } from './JSON.ts';

import { throwExpression } from '../Error.ts';
import { normalizeOptionalProperties } from '../Object.ts';
import { ObsidianPluginRepoPaths } from '../obsidian/Plugin/ObsidianPluginRepoPaths.ts';
import {
  editJson,
  editJsonSync,
  readJson,
  readJsonSync,
  writeJson,
  writeJsonSync
} from './JSON.ts';
import { resolvePathFromRoot } from './Root.ts';

/**
 * Options for editing a package.json file.
 */
export interface EditPackageJsonOptions {
  /**
   * The current working folder where `package.json` is located.
   */
  cwd?: string;

  /**
   * If true, skips editing if the file does not exist.
   */
  shouldSkipIfMissing?: boolean;
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
 * Reads, edits, and writes back the `package-lock.json` file using the provided edit function.
 *
 * @param editFn - The function to edit the parsed `PackageJson` object.
 * @param options - Additional options for editing.
 * @returns A {@link Promise} that resolves when the file has been edited and written.
 */
export async function editNpmShrinkWrapJson(
  editFn: (packageLockJson: PackageLockJson) => Promisable<void>,
  options: EditPackageJsonOptions = {}
): Promise<void> {
  const {
    cwd,
    shouldSkipIfMissing
  } = options;
  await editJson<PackageJson>(getNpmShrinkWrapJsonPath(cwd), editFn, normalizeOptionalProperties<EditJsonOptions>({ shouldSkipIfMissing }));
}

/**
 * Reads, edits, and writes back the `package.json` file using the provided edit function.
 *
 * @param editFn - The function to edit the parsed `PackageJson` object.
 * @param options - Additional options for editing.
 * @returns A {@link Promise} that resolves when the file has been edited and written.
 */
export async function editPackageJson(
  editFn: (packageJson: PackageJson) => Promisable<void>,
  options: EditPackageJsonOptions = {}
): Promise<void> {
  const {
    cwd,
    shouldSkipIfMissing
  } = options;
  await editJson<PackageJson>(getPackageJsonPath(cwd), editFn, normalizeOptionalProperties<EditJsonOptions>({ shouldSkipIfMissing }));
}

/**
 * Reads, edits, and writes back the `package.json` file using the provided edit function.
 *
 * @param editFn - The function to edit the parsed `PackageJson` object.
 * @param options - Additional options for editing.
 */
export function editPackageJsonSync(
  editFn: (packageJson: PackageJson) => void,
  options: EditPackageJsonOptions = {}
): void {
  const {
    cwd,
    shouldSkipIfMissing
  } = options;
  editJsonSync<PackageJson>(getPackageJsonPath(cwd), editFn, normalizeOptionalProperties<EditJsonOptions>({ shouldSkipIfMissing }));
}

/**
 * Reads, edits, and writes back the `package-lock.json` file using the provided edit function.
 *
 * @param editFn - The function to edit the parsed `PackageJson` object.
 * @param options - Additional options for editing.
 * @returns A {@link Promise} that resolves when the file has been edited and written.
 */
export async function editPackageLockJson(
  editFn: (packageLockJson: PackageLockJson) => Promisable<void>,
  options: EditPackageJsonOptions = {}
): Promise<void> {
  const {
    cwd,
    shouldSkipIfMissing
  } = options;
  await editJson<PackageJson>(getPackageLockJsonPath(cwd), editFn, normalizeOptionalProperties<EditJsonOptions>({ shouldSkipIfMissing }));
}

/**
 * Reads, edits, and writes back the `package-lock.json` file using the provided edit function.
 *
 * @param editFn - The function to edit the parsed `PackageLockJson` object.
 * @param options - Additional options for editing.
 */
export function editPackageLockJsonSync(
  editFn: (packageLockJson: PackageLockJson) => void,
  options: EditPackageJsonOptions = {}
): void {
  const {
    cwd,
    shouldSkipIfMissing
  } = options;
  editJsonSync<PackageLockJson>(getPackageLockJsonPath(cwd), editFn, normalizeOptionalProperties<EditJsonOptions>({ shouldSkipIfMissing }));
}

/**
 * Resolves the path to the `npm-shrinkwrap.json` file in the specified folder or in the root if no folder is specified.
 *
 * @param cwd - The current working folder where `npm-shrinkwrap.json` is located.
 * @returns The resolved path to the `npm-shrinkwrap.json` file.
 */
export function getNpmShrinkWrapJsonPath(cwd?: string): string {
  return resolvePathFromRoot(ObsidianPluginRepoPaths.NpmShrinkwrapJson, cwd) ?? throwExpression(new Error('Could not determine the npm-shrinkwrap.json path'));
}

/**
 * Resolves the path to the `package.json` file in the specified folder or in the root if no folder is specified.
 *
 * @param cwd - The current working folder where `package.json` is located.
 * @returns The resolved path to the `package.json` file.
 */
export function getPackageJsonPath(cwd?: string): string {
  return resolvePathFromRoot(ObsidianPluginRepoPaths.PackageJson, cwd) ?? throwExpression(new Error('Could not determine the package.json path'));
}

/**
 * Resolves the path to the `package-lock.json` file in the specified folder or in the root if no folder is specified.
 *
 * @param cwd - The current working folder where `package-lock.json` is located.
 * @returns The resolved path to the `package-lock.json` file.
 */
export function getPackageLockJsonPath(cwd?: string): string {
  return resolvePathFromRoot(ObsidianPluginRepoPaths.PackageLockJson, cwd) ?? throwExpression(new Error('Could not determine the package-lock.json path'));
}

/**
 * Reads the `package.json` file from the specified folder or from the root if no folder is specified.
 *
 * @param cwd - The current working folder where `package.json` is located.
 * @returns A {@link Promise} that resolves with the parsed `PackageJson` object.
 */
export async function readPackageJson(cwd?: string): Promise<PackageJson> {
  return await readJson<PackageJson>(getPackageJsonPath(cwd));
}

/**
 * Reads the `package.json` file from the specified folder or from the root if no folder is specified.
 *
 * @param cwd - The current working folder where `package.json` is located.
 * @returns The parsed `PackageJson` object.
 */
export function readPackageJsonSync(cwd?: string): PackageJson {
  return readJsonSync<PackageJson>(getPackageJsonPath(cwd));
}

/**
 * Reads the `package-lock.json` file from the specified folder or from the root if no folder is specified.
 *
 * @param cwd - The current working folder where `package-lock.json` is located.
 * @returns A {@link Promise} that resolves with the parsed `PackageJson` object.
 */
export async function readPackageLockJson(cwd?: string): Promise<PackageLockJson> {
  return await readJson<PackageLockJson>(getPackageLockJsonPath(cwd));
}

/**
 * Reads the `package-lock.json` file from the specified folder or from the root if no folder is specified.
 *
 * @param cwd - The current working folder where `package-lock.json` is located.
 * @returns The parsed `PackageLockJson` object.
 */
export function readPackageLockJsonSync(cwd?: string): PackageLockJson {
  return readJsonSync<PackageLockJson>(getPackageLockJsonPath(cwd));
}

/**
 * Writes the provided `PackageJson` object to the `package.json` file in the specified folder or in the root.
 *
 * @param packageJson - The `PackageJson` object to write.
 * @param cwd - The current working folder where `package.json` is located.
 * @returns A {@link Promise} that resolves when the file has been written.
 */
export async function writePackageJson(packageJson: PackageJson, cwd?: string): Promise<void> {
  await writeJson(getPackageJsonPath(cwd), packageJson);
}

/**
 * Writes the provided `PackageJson` object to the `package.json` file in the specified folder or in the root.
 *
 * @param packageJson - The `PackageJson` object to write.
 * @param cwd - The current working folder where `package.json` is located.
 */
export function writePackageJsonSync(packageJson: PackageJson, cwd?: string): void {
  writeJsonSync(getPackageJsonPath(cwd), packageJson);
}

/**
 * Writes the provided `PackageJson` object to the `package-lock.json` file in the specified folder or in the root.
 *
 * @param packageLockJson - The `PackageLockJson` object to write.
 * @param cwd - The current working folder where `package-lock.json` is located.
 * @returns A {@link Promise} that resolves when the file has been written.
 */
export async function writePackageLockJson(packageLockJson: PackageLockJson, cwd?: string): Promise<void> {
  await writeJson(getPackageLockJsonPath(cwd), packageLockJson);
}

/**
 * Writes the provided `PackageLockJson` object to the `package-lock.json` file in the specified folder or in the root.
 *
 * @param packageLockJson - The `PackageLockJson` object to write.
 * @param cwd - The current working folder where `package-lock.json` is located.
 */
export function writePackageLockJsonSync(packageLockJson: PackageLockJson, cwd?: string): void {
  writeJsonSync(getPackageLockJsonPath(cwd), packageLockJson);
}
