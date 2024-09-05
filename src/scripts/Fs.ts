/**
 * @packageDocumentation Fs
 * Contains utility functions for file system operations.
 */

import type {
  Dirent,
  ObjectEncodingOptions,
  PathLike
} from 'node:fs';
import { readdir } from 'node:fs/promises';
import {
  toPosixBuffer,
  toPosixPath
} from '../Path.ts';

/**
 * Options for controlling the format of the result when returning strings.
 */
export type StringResultOptions = undefined | ObjectEncodingOptions & {
  /**
   * Should be set to `false` to return strings.
   */
  withFileTypes?: false;

  /**
   * Whether to include subdirectories when reading the directory. If not provided, defaults to `false`.
   */
  recursive?: boolean;
};

/**
 * Options for controlling the format of the result when returning buffers.
 */
export type BufferResultOptions = 'buffer' | {
  /**
   * Should be set to "buffer" to return buffers.
   */
  encoding: 'buffer';

  /**
   * Should be set to `false` to return buffers.
   */
  withFileTypes?: false;

  /**
   * Whether to include subdirectories when reading the directory. If not provided, defaults to `false`.
   */
  recursive?: boolean;
};

/**
 * Options for controlling the format of the result when returning Dirent objects.
 */
export type DirentResultOptions = ObjectEncodingOptions & {
  /**
   * Should be set to `true` to return Dirent objects.
   */
  withFileTypes: true;

  /**
   * Whether to include subdirectories when reading the directory. If not provided, defaults to `false`.
   */
  recursive?: boolean;
};

/**
 * Common options for controlling the format of the result.
 */
interface CommonOptions {
  /**
   * Encoding to use when returning strings.
   */
  encoding?: BufferEncoding | 'buffer';

  /**
   * Set `true` to return Dirent objects or `false` to return strings or buffers.
   */
  withFileTypes?: boolean;
}

/**
 * Reads the contents of a directory and returns an array of strings with POSIX paths.
 *
 * @param path - The path to the directory.
 * @param options - Options to control the format of the result. If not provided, returns strings.
 * @returns A promise that resolves with an array of POSIX-formatted file paths.
 */
export async function readdirPosix(path: PathLike, options?: StringResultOptions): Promise<string[]>;

/**
 * Reads the contents of a directory and returns an array of buffers with POSIX paths.
 *
 * @param path - The path to the directory.
 * @param options - Options to control the format of the result. Specify "buffer" to return buffers.
 * @returns A promise that resolves with an array of POSIX-formatted buffers.
 */
export async function readdirPosix(path: PathLike, options: BufferResultOptions): Promise<Buffer[]>;

/**
 * Reads the contents of a directory and returns an array of Dirent objects with POSIX paths.
 *
 * @param path - The path to the directory.
 * @param options - Options to control the format of the result. Specify `withFileTypes: true` to return Dirent objects.
 * @returns A promise that resolves with an array of POSIX-formatted Dirent objects.
 */
export async function readdirPosix(path: PathLike, options: DirentResultOptions): Promise<Dirent[]>;

/**
 * Reads the contents of a directory and converts file paths or buffer results to POSIX format.
 *
 * @param path - The path to the directory.
 * @param options - Options to control the format of the result.
 * @returns A promise that resolves with an array of POSIX-formatted file paths, buffers, or Dirent objects.
 */
export async function readdirPosix(
  path: PathLike,
  options: StringResultOptions | BufferResultOptions | DirentResultOptions = {}
): Promise<string[] | Buffer[] | Dirent[]> {
  if (isStringResultOptions(options)) {
    const paths = await readdir(path, options);
    return paths.map(toPosixPath);
  }

  if (isBufferResultOptions(options)) {
    const buffers = await readdir(path, options);
    return buffers.map(toPosixBuffer);
  }

  const dirents = await readdir(path, options);
  for (const dirent of dirents) {
    dirent.name = toPosixPath(dirent.name);
    dirent.parentPath = toPosixPath(dirent.parentPath);
  }

  return dirents;
}

/**
 * Type guard to check if the options are for returning strings.
 *
 * @param options - The options to check.
 * @returns `true` if the options are for returning strings, otherwise `false`.
 */
function isStringResultOptions(options: StringResultOptions | BufferResultOptions | DirentResultOptions): options is StringResultOptions {
  if (options === undefined) {
    return true;
  }

  if (options === 'buffer') {
    return false;
  }

  const commonOptions = options as CommonOptions;

  if (commonOptions.encoding === 'buffer') {
    return false;
  }

  if (commonOptions.withFileTypes === true) {
    return false;
  }

  return true;
}

/**
 * Type guard to check if the options are for returning buffers.
 *
 * @param options - The options to check.
 * @returns `true` if the options are for returning buffers, otherwise `false`.
 */
function isBufferResultOptions(options: StringResultOptions | BufferResultOptions | DirentResultOptions): options is BufferResultOptions {
  if (options === undefined) {
    return false;
  }

  if (options === 'buffer') {
    return true;
  }

  const commonOptions = options as CommonOptions;

  if (commonOptions.withFileTypes === true) {
    return false;
  }

  if (commonOptions.encoding !== 'buffer') {
    return false;
  }

  return true;
}
