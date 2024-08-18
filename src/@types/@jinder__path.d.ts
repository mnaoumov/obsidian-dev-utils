/**
 * @fileoverview
 * This module provides path-related utilities for handling and transforming file paths
 * in both POSIX and Windows environments. It includes functions to resolve, normalize,
 * and join paths, as well as parse and format path strings. The module supports both
 * CommonJS and ECMAScript module systems, allowing it to be used in various runtime
 * environments.
 */

declare module "@jinder/path" {
  /**
   * Represents the parsed components of a path.
   */
  interface ParsedPath {
    /** The root of the path, such as `'/'` or `'C:\'` */
    root: string;
    /** The directory of the path, including the root */
    dir: string;
    /** The last portion of the path, typically the file name */
    base: string;
    /** The file extension of the path */
    ext: string;
    /** The file name without the extension */
    name: string;
  }

  /**
   * A module for handling and transforming file paths.
   */
  interface PathModule {
    /**
     * Resolves a sequence of paths or path segments into an absolute path.
     *
     * @param pathSegments - A sequence of paths or path segments.
     * @returns The resolved absolute path.
     */
    resolve(this: void, ...pathSegments: string[]): string;

    /**
     * Normalizes the given path, resolving `..` and `.` segments.
     *
     * @param path - The path to normalize.
     * @returns The normalized path.
     */
    normalize(this: void, path: string): string;

    /**
     * Determines whether the given path is an absolute path.
     *
     * @param path - The path to test.
     * @returns `true` if the path is absolute, otherwise `false`.
     */
    isAbsolute(this: void, path: string): boolean;

    /**
     * Joins all given path segments together using the platform-specific separator.
     *
     * @param paths - The path segments to join.
     * @returns The joined path.
     */
    join(this: void, ...paths: string[]): string;

    /**
     * Computes the relative path from `from` to `to` based on the current working directory.
     *
     * @param from - The starting path.
     * @param to - The target path.
     * @returns The relative path from `from` to `to`.
     */
    relative(this: void, from: string, to: string): string;

    /**
     * Converts a path into its long form, if necessary.
     *
     * @param path - The path to convert.
     * @returns The long form of the path.
     */
    _makeLong(this: void, path: string): string;

    /**
     * Returns the directory name of a path.
     *
     * @param path - The path to evaluate.
     * @returns The directory name.
     */
    dirname(this: void, path: string): string;

    /**
     * Returns the last portion of a path, such as the file name.
     *
     * @param path - The path to evaluate.
     * @param ext - Optional extension to remove from the end of the path.
     * @returns The last portion of the path.
     */
    basename(this: void, path: string, ext?: string): string;

    /**
     * Returns the extension of the path.
     *
     * @param path - The path to evaluate.
     * @returns The extension of the path.
     */
    extname(this: void, path: string): string;

    /**
     * Formats a path object into a path string.
     *
     * @param pathObject - An object containing properties such as `root`, `dir`, `base`, `name`, and `ext`.
     * @returns The formatted path string.
     */
    format(this: void, pathObject: Partial<ParsedPath>): string;

    /**
     * Parses a path string into an object with `root`, `dir`, `base`, `ext`, and `name` properties.
     *
     * @param pathString - The path string to parse.
     * @returns An object with the parsed path components.
     */
    parse(this: void, pathString: string): ParsedPath;

    /** The platform-specific path segment separator (`'/'` on POSIX and `'\\'` on Windows). */
    readonly sep: string;

    /** The platform-specific path delimiter (`':'` on POSIX and `';'` on Windows). */
    readonly delimiter: string;
  }

  /**
   * The `PathModule` implementation for Windows-style paths.
   */
  export const win32: PathModule;

  /**
   * The `PathModule` implementation for POSIX-style paths.
   */
  export const posix: PathModule;

  /**
   * Resolves a sequence of paths or path segments into an absolute path using the platform-specific implementation.
   */
  export const resolve: PathModule["resolve"];

  /**
   * Normalizes the given path using the platform-specific implementation.
   */
  export const normalize: PathModule["normalize"];

  /**
   * Determines whether the given path is an absolute path using the platform-specific implementation.
   */
  export const isAbsolute: PathModule["isAbsolute"];

  /**
   * Joins all given path segments together using the platform-specific separator.
   */
  export const join: PathModule["join"];

  /**
   * Computes the relative path from `from` to `to` based on the current working directory.
   */
  export const relative: PathModule["relative"];

  /**
   * Converts a path into its long form using the platform-specific implementation.
   */
  export const _makeLong: PathModule["_makeLong"];

  /**
   * Returns the directory name of a path using the platform-specific implementation.
   */
  export const dirname: PathModule["dirname"];

  /**
   * Returns the last portion of a path, such as the file name, using the platform-specific implementation.
   */
  export const basename: PathModule["basename"];

  /**
   * Returns the extension of the path using the platform-specific implementation.
   */
  export const extname: PathModule["extname"];

  /**
   * Formats a path object into a path string using the platform-specific implementation.
   */
  export const format: PathModule["format"];

  /**
   * Parses a path string into an object with `root`, `dir`, `base`, `ext`, and `name` properties using the platform-specific implementation.
   */
  export const parse: PathModule["parse"];

  /** The platform-specific path segment separator (`'/'` on POSIX and `'\\'` on Windows). */
  export const sep: PathModule["sep"];

  /** The platform-specific path delimiter (`':'` on POSIX and `';'` on Windows). */
  export const delimiter: PathModule["delimiter"];

  /**
   * The `PathModule` implementation for the current platform.
   */
  const defaultModule: PathModule;

  export default defaultModule;
}
