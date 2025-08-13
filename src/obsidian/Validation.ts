/**
 * @packageDocumentation
 *
 * Validation utilities.
 */

import { Platform } from 'obsidian';

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
 * Gets the regular expression for invalid file name path characters.
 *
 * @param isWindows - Whether to use Windows-specific invalid file name path characters. Default is `Platform.isWin`.
 * @returns The regular expression for invalid file name path characters.
 */
export function getInvalidFileNamePathCharsRegExp(isWindows?: boolean): RegExp {
  isWindows ??= Platform.isWin;
  const WINDOWS_INVALID_FILENAME_PATH_CHARS = /[*\\/<>:|?"]/g;
  const UNIX_INVALID_FILENAME_PATH_CHARS = /\0\//g;
  return isWindows ? WINDOWS_INVALID_FILENAME_PATH_CHARS : UNIX_INVALID_FILENAME_PATH_CHARS;
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
 * The forbidden file name characters for Obsidian.
 */
export const OBSIDIAN_FORBIDDEN_FILE_NAME_CHARS_REG_EXP = /[#^[\]|]/g;
