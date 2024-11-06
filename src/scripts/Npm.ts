/**
 * @packageDocumentation Npm
 * Contains utility functions for NPM package.json.
 */

import type { MaybePromise } from '../Async.ts';

import { ObsidianPluginRepoPaths } from '../obsidian/Plugin/ObsidianPluginRepoPaths.ts';
import {
  editJson,
  readJson,
  writeJson
} from './JSON.ts';
import { resolvePathFromRoot } from './Root.ts';

/**
 * Represents the structure of an `NpmPackage` as defined in a `package.json` file.
 */
export interface NpmPackage {
  /**
   * An optional object that contains the package's dependencies, where the key is the package name
   * and the value is the version required.
   */
  dependencies?: Record<string, string>;

  /**
   * An optional object that contains the package's development dependencies, where the key is the package name
   * and the value is the version required.
   */
  devDependencies?: Record<string, string>;

  /**
   * An optional object that defines the package's export mappings, where the key is the export name
   * and the value is the export details.
   */
  exports?: Record<string, Export>;

  /**
   * The name of the package.
   */
  name: string;

  /**
   * An optional object that contains the package's peer dependencies, where the key is the package name
   */
  packages?: Record<string, NpmPackage>;

  /**
   * The version of the package.
   */
  version: string;
}

/**
 * Represents the export details in the `exports` field of a `package.json` file.
 */
interface Export {
  /**
   * The default export path for the package.
   */
  default: string;

  /**
   * The path to the types file for the package.
   */
  types: string;
}

/**
 * Reads the `package.json` file from the specified directory or from the root if no directory is specified.
 *
 * @param cwd - The current working directory where `package.json` is located.
 * @returns A promise that resolves with the parsed `NpmPackage` object.
 */
export async function readNpmPackage(cwd?: string): Promise<NpmPackage> {
  return await readJson<NpmPackage>(getPackageJsonPath(cwd));
}

/**
 * Writes the provided `NpmPackage` object to the `package.json` file in the specified directory or in the root.
 *
 * @param npmPackage - The `NpmPackage` object to write.
 * @param cwd - The current working directory where `package.json` is located.
 * @returns A promise that resolves when the file has been written.
 */
export async function writeNpmPackage(npmPackage: NpmPackage, cwd?: string): Promise<void> {
  await writeJson(getPackageJsonPath(cwd), npmPackage);
}

/**
 * Options for editing an NPM package.
 */
export interface EditNpmPackageOptions {
  /**
   * The current working directory where `package.json` is located.
   */
  cwd?: string | undefined;

  /**
   * If true, skips editing if the file does not exist.
   */
  skipIfMissing?: boolean | undefined;
}

/**
 * Reads, edits, and writes back the `package.json` file using the provided edit function.
 *
 * @param editFn - The function to edit the parsed `NpmPackage` object.
 * @param options - Additional options for editing.
 * @returns A promise that resolves when the file has been edited and written.
 */
export async function editNpmPackage(
  editFn: (npmPackage: NpmPackage) => MaybePromise<void>, options: EditNpmPackageOptions = {}): Promise<void> {
  const {
    cwd,
    skipIfMissing
  } = options;
  await editJson<NpmPackage>(getPackageJsonPath(cwd), editFn, { skipIfMissing });
}

/**
 * Reads the `package-lock.json` file from the specified directory or from the root if no directory is specified.
 *
 * @param cwd - The current working directory where `package-lock.json` is located.
 * @returns A promise that resolves with the parsed `NpmPackage` object.
 */
export async function readNpmPackageLock(cwd?: string): Promise<NpmPackage> {
  return await readJson<NpmPackage>(getPackageLockJsonPath(cwd));
}

/**
 * Writes the provided `NpmPackage` object to the `package-lock.json` file in the specified directory or in the root.
 *
 * @param npmPackage - The `NpmPackage` object to write.
 * @param cwd - The current working directory where `package-lock.json` is located.
 * @returns A promise that resolves when the file has been written.
 */
export async function writeNpmPackageLock(npmPackage: NpmPackage, cwd?: string): Promise<void> {
  await writeJson(getPackageLockJsonPath(cwd), npmPackage);
}

/**
 * Reads, edits, and writes back the `package-lock.json` file using the provided edit function.
 *
 * @param editFn - The function to edit the parsed `NpmPackage` object.
 * @param options - Additional options for editing.
 * @returns A promise that resolves when the file has been edited and written.
 */
export async function editNpmPackageLock(
  editFn: (npmPackage: NpmPackage) => MaybePromise<void>,
  options: EditNpmPackageOptions = {}): Promise<void> {
  const {
    cwd,
    skipIfMissing
  } = options;
  await editJson<NpmPackage>(getPackageLockJsonPath(cwd), editFn, { skipIfMissing });
}

/**
 * Resolves the path to the `package.json` file in the specified directory or in the root if no directory is specified.
 *
 * @param cwd - The current working directory where `package.json` is located.
 * @returns The resolved path to the `package.json` file.
 */
export function getPackageJsonPath(cwd?: string): string {
  return resolvePathFromRoot(ObsidianPluginRepoPaths.PackageJson, cwd);
}

/**
 * Resolves the path to the `package-lock.json` file in the specified directory or in the root if no directory is specified.
 *
 * @param cwd - The current working directory where `package-lock.json` is located.
 * @returns The resolved path to the `package-lock.json` file.
 */
export function getPackageLockJsonPath(cwd?: string): string {
  return resolvePathFromRoot(ObsidianPluginRepoPaths.PackageLockJson, cwd);
}
