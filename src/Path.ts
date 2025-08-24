/**
 * @packageDocumentation
 *
 * Contains utility functions for handling paths.
 */

import pathBrowserify from 'path-browserify';

import {
  ensureStartsWith,
  replaceAll
} from './String.ts';

const WINDOWS_POSIX_LIKE_PATH_REG_EXP = /[a-zA-Z]:\/[^:]*$/;

/**
 * Provides methods for handling POSIX paths.
 */
export const posix = pathBrowserify.posix;

/**
 * A POSIX path delimiter.
 */
export const delimiter = posix.delimiter;

/**
 * A POSIX segment separator.
 */
export const sep = pathBrowserify.posix.sep;

/**
 * Returns the base name of a file, optionally removing the file extension.
 *
 * @param path - The path to get the base name from.
 * @param ext - An optional extension to remove from the base name.
 * @returns The base name of the file.
 */
export const basename = posix.basename;

/**
 * Returns the directory name of a path.
 *
 * `directory` is used instead of `folder` to preserve compatibility with `node:path` module.
 *
 * @param path - The path to get the directory name from.
 * @returns The directory name of the path.
 */
export const dirname = posix.dirname;

/**
 * Returns the file extension of a path.
 *
 * @param path - The path to get the extension from.
 * @returns The file extension of the path.
 */
export const extname = posix.extname;

/**
 * Formats a path object into a path string.
 *
 * @param pathObject - The path object to format.
 * @returns The formatted path string.
 */
export const format = posix.format;

/**
 * Determines if a path is absolute.
 *
 * @param path - The path to check.
 * @returns `true` if the path is absolute, `false` otherwise.
 */
export function isAbsolute(path: string): boolean {
  return posix.isAbsolute(path) || WINDOWS_POSIX_LIKE_PATH_REG_EXP.exec(path)?.[0] === path;
}

/**
 * Joins multiple path segments into a single path.
 *
 * @param paths - The path segments to join.
 * @returns The joined path.
 */
export const join = posix.join;

/**
 * Normalizes a path, resolving '..' and '.' segments.
 *
 * @param path - The path to normalize.
 * @returns The normalized path.
 */
export const normalize = posix.normalize;

/**
 * Parses a path string into a path object.
 *
 * @param path - The path string to parse.
 * @returns The parsed path object.
 */
export const parse = posix.parse;

/**
 * Returns the relative path from one path to another.
 *
 * @param from - The starting path.
 * @param to - The destination path.
 * @returns The relative path from `from` to `to`.
 */
export const relative = posix.relative;

/**
 * Gets the file name from the `import(dot)meta(dot)url`, converting it to a POSIX-style path.
 *
 * @param importMetaUrl - The `import(dot)meta(dot)url` from which to extract the file name.
 * @returns The POSIX-style file name.
 */
export function getFileName(importMetaUrl: string): string {
  return resolve(decodeURI(new URL(importMetaUrl).pathname));
}

/**
 * Gets the folder name from the `import(dot)meta(dot)url`, converting it to a POSIX-style path.
 *
 * @param importMetaUrl - The `import(dot)meta(dot)url` from which to extract the folder name.
 * @returns The POSIX-style folder name.
 */
export function getFolderName(importMetaUrl: string): string {
  return dirname(getFileName(importMetaUrl));
}

/**
 * Makes a file name by appending an extension to a given file name.
 * If the extension is empty, the file name is returned as is.
 *
 * @param fileName - The file name to append the extension to.
 * @param extension - The extension to append to the file name.
 * @returns The file name with the extension appended.
 */
export function makeFileName(fileName: string, extension: string): string {
  return extension ? `${fileName}.${extension}` : fileName;
}

/**
 * Normalizes a given path by ensuring it is relative, adding "./" if necessary.
 *
 * @param path - The path to normalize.
 * @returns The normalized path, starting with "./" if it was relative.
 */
export function normalizeIfRelative(path: string): string {
  if (path.startsWith('/') || path.includes(':')) {
    return path;
  }

  return ensureStartsWith(path, './');
}

/**
 * Resolves a sequence of paths or path segments into an absolute path.
 *
 * @param pathSegments - The sequence of path segments to resolve.
 * @returns The resolved absolute path.
 */
export function resolve(...pathSegments: string[]): string {
  let path = posix.resolve(...pathSegments);
  path = toPosixPath(path);
  const match = WINDOWS_POSIX_LIKE_PATH_REG_EXP.exec(path);
  return match?.[0] ?? path;
}

/**
 * Converts a buffer containing a path to a POSIX-style buffer by replacing backslashes with forward slashes.
 *
 * @param buffer - The buffer to convert.
 * @returns A new buffer containing the POSIX-style path.
 */
export function toPosixBuffer(buffer: Buffer): Buffer {
  return Buffer.from(toPosixPath(String(buffer)));
}

/**
 * Converts a given path to a POSIX-style path by replacing backslashes with forward slashes.
 *
 * @param path - The path to convert.
 * @returns The POSIX-style path.
 */
export function toPosixPath(path: string): string {
  return replaceAll(path, '\\', '/');
}
