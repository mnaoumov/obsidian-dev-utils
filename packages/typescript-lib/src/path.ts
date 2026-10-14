/**
 * @file
 *
 * Contains utility functions for handling paths.
 */

import pathBrowserify from 'path-browserify';

import {
  ensureStartsWith,
  replaceAll
} from './string.ts';

const WINDOWS_DRIVE_REG_EXP = /^[a-zA-Z]:\//;
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
export const separator = pathBrowserify.posix.sep;

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
export const normalizePath = posix.normalize;

/**
 * Parses a path string into a path object.
 *
 * @param path - The path string to parse.
 * @returns The parsed path object.
 */
export const parse = posix.parse;

/**
 * Parameters for {@link makeFileName}.
 */
export interface MakeFileNameParams {
  /**
   * The file name to append the extension to.
   */
  readonly fileBaseName: string;

  /**
   * The extension to append to the file name.
   */
  readonly fileExtension: string;
}

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
 * @param params - The parameters for making the file name.
 * @returns The file name with the extension appended.
 */
export function makeFileName(params: MakeFileNameParams): string {
  return params.fileExtension ? `${params.fileBaseName}.${params.fileExtension}` : params.fileBaseName;
}

/**
 * Normalizes a given path by ensuring it is relative, adding "./" if necessary.
 *
 * @param path - The path to normalize.
 * @returns The normalized path, starting with "./" if it was relative.
 */
export function normalizeIfRelative(path: string): string {
  return path.startsWith('/') || path.includes(':')
    ? path
    : ensureStartsWith({
      $string: path,
      prefix: './'
    });
}

/**
 * Returns the relative path from one path to another.
 *
 * `path-browserify`'s own `relative` cannot be used directly: it resolves a relative argument against
 * `process.cwd()`, which on Windows is `F:\...` rather than a POSIX absolute path, and its slicing then assumes a
 * leading `/` - so `relative('src', '../x')` came back as `'../..x'`. Both arguments are resolved through
 * {@link resolve} here instead, and rooted at `/` before the POSIX comparison.
 *
 * @param from - The starting path.
 * @param to - The destination path.
 * @returns The relative path from `from` to `to`.
 */
export function relative(from: string, to: string): string {
  const resolvedFrom = resolve(from);
  const resolvedTo = resolve(to);
  const fromDrive = WINDOWS_DRIVE_REG_EXP.exec(resolvedFrom)?.[0].toUpperCase();
  const toDrive = WINDOWS_DRIVE_REG_EXP.exec(resolvedTo)?.[0].toUpperCase();
  return fromDrive === toDrive
    ? posix.relative(toRootedPosixPath(upperCaseDrive(resolvedFrom)), toRootedPosixPath(upperCaseDrive(resolvedTo)))
    : resolvedTo;
}

/**
 * Resolves a sequence of paths or path segments into an absolute path.
 *
 * @param pathSegments - The sequence of path segments to resolve.
 * @returns The resolved absolute path.
 */
export function resolve(...pathSegments: string[]): string {
  /*
   * `path-browserify` treats only a leading `/` as absolute and joins `process.cwd()` in as an opaque segment, so on
   * Windows a `..` climbing out of the working folder cancelled the whole `F:\...` cwd. Every segment is made POSIX
   * and a drive root is given a leading `/`, which makes it a root `path-browserify` understands; the `/` is dropped
   * again below.
   */
  const rootedSegments = pathSegments.map((segment) => toRootedPosixPath(segment));
  if (rootedSegments.every((segment) => !segment.startsWith('/'))) {
    rootedSegments.unshift(toRootedPosixPath(process.cwd()));
  }
  const path = posix.resolve(...rootedSegments);
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
  return replaceAll({
    $string: path,
    replacer: '/',
    searchValue: '\\'
  });
}

function toRootedPosixPath(path: string): string {
  const posixPath = toPosixPath(path);
  return WINDOWS_DRIVE_REG_EXP.test(posixPath) ? `/${posixPath}` : posixPath;
}

function upperCaseDrive(path: string): string {
  return path.replace(WINDOWS_DRIVE_REG_EXP, (drive) => drive.toUpperCase());
}
