/**
 * @file
 *
 * Validation utilities.
 */

import { Platform } from 'obsidian';

import {
  basename,
  extname
} from '../path.ts';
import { oneOf } from '../reg-exp.ts';

/**
 * Holds a validation message.
 */
export interface ValidationMessageHolder {
  /**
   * A validation message.
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
 * The MS-DOS device names Windows still refuses as a file name, with or without an extension.
 *
 * `CONIN$` / `CONOUT$` and the superscript `COM²` forms are deliberately absent: they are accepted by
 * every Windows version that runs Obsidian, and matching them would rename files that work.
 *
 * Unlike the exported character sets above, this carries no `g` flag, so `test` may be called on it
 * repeatedly — a `g`-flagged regexp advances `lastIndex` and answers differently on consecutive calls.
 */
const WINDOWS_RESERVED_NAME_REG_EXP = /^(?:AUX|COM[1-9]|CON|LPT[1-9]|NUL|PRN)$/i;

/**
 * The trailing dots and spaces Windows strips from a name before it does anything else with it.
 */
const WINDOWS_TRAILING_CHARS_REG_EXP = /[ .]+$/;

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

/**
 * Checks whether a name ends with the dots or spaces Windows refuses.
 *
 * Answers for Windows regardless of the platform in use: a vault is synced, so the rules that matter are
 * not necessarily those of the machine asking.
 *
 * @param name - The name to check. A single path segment, not a path.
 * @returns `true` if the name ends with a dot or a space, `false` otherwise.
 */
export function hasWindowsTrailingChars(name: string): boolean {
  return WINDOWS_TRAILING_CHARS_REG_EXP.test(name);
}

/**
 * Checks whether a name is one of the MS-DOS device names Windows refuses.
 *
 * Two steps the caller would otherwise have to know about happen here: trailing dots and spaces are
 * trimmed BEFORE the test, because Windows strips them before deciding and `CON ` is therefore as
 * reserved as `CON`; and the extension is dropped, because `CON.md` is reserved too.
 *
 * `CONIN$` / `CONOUT$` and the superscript `COM²` forms are deliberately NOT reserved: they are accepted
 * by every Windows version that runs Obsidian, and matching them would rename files that work.
 *
 * Answers for Windows regardless of the platform in use: a vault is synced, so the rules that matter are
 * not necessarily those of the machine asking.
 *
 * @param name - The name to check. A single path segment, with or without its extension.
 * @returns `true` if the name is reserved, `false` otherwise.
 */
export function isWindowsReservedName(name: string): boolean {
  const trimmedName = trimWindowsTrailingChars(name);
  return WINDOWS_RESERVED_NAME_REG_EXP.test(basename(trimmedName, extname(trimmedName)));
}

/**
 * Removes the trailing dots and spaces Windows refuses from the end of a name.
 *
 * Trim before testing for a reserved name, never after: trimming afterwards turns an accepted `CON ` into
 * a rejected `CON`. {@link isWindowsReservedName} already does this internally.
 *
 * @param name - The name to trim. A single path segment, not a path.
 * @returns The name without its trailing dots and spaces, which may be empty.
 */
export function trimWindowsTrailingChars(name: string): string {
  return name.replace(WINDOWS_TRAILING_CHARS_REG_EXP, '');
}
