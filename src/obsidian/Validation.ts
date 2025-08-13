/**
 * @packageDocumentation
 *
 * Validation utilities.
 */

import { Platform } from 'obsidian';

import { oneOf } from '../RegExp.ts';

/**
 * Holds a validation message.
 */
export interface ValidationMessageHolder {
  /**
   * The validation message.
   */
  validationMessage: string;
}

/**
 * Type guard to check if a value is a validation message holder.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a validation message holder, `false` otherwise.
 */
export function isValidationMessageHolder(value: unknown): value is ValidationMessageHolder {
  return (value as Partial<ValidationMessageHolder>).validationMessage !== undefined;
}

/**
 * Matches characters that are not safe to use in file names within Obsidian.
 */
export const OBSIDIAN_UNSAFE_FILENAME_CHARS = /[#^[\]|]/g;

/**
 * Windows-specific unsafe file name path characters.
 */
export const WINDOWS_UNSAFE_PATH_CHARS = /[*\\/<>:|?"]/g;

/**
 * Unix-specific unsafe file name path characters.
 */
export const UNIX_UNSAFE_PATH_CHARS = /[\0/]/g;

/**
 * Returns a regexp matching all unsafe characters in file names/paths.
 *
 * Includes both OS-specific restrictions and Obsidian-specific ones.
 *
 * @param isWindows - Whether to include Windows-specific restrictions. Defaults to `Platform.isWin`.
 * @returns A regexp matching all unsafe characters in file names/paths.
 */
export function getOsAndObsidianUnsafePathCharsRegExp(isWindows?: boolean): RegExp {
  return oneOf([
    getOsUnsafePathCharsRegExp(isWindows),
    OBSIDIAN_UNSAFE_FILENAME_CHARS
  ]);
}

/**
 * Returns a regexp matching characters that are not safe to use in file names/paths at the OS level.
 *
 * @param isWindows - Whether to include Windows-specific restrictions. Defaults to `Platform.isWin`.
 * @returns A regexp matching characters that are not safe to use in file names/paths at the OS level.
 */
export function getOsUnsafePathCharsRegExp(isWindows?: boolean): RegExp {
  isWindows ??= Platform.isWin;
  return isWindows ? WINDOWS_UNSAFE_PATH_CHARS : UNIX_UNSAFE_PATH_CHARS;
}
