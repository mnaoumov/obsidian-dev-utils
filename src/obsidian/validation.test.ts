// @vitest-environment jsdom
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  getOsAndObsidianUnsafePathCharsRegExp,
  getOsUnsafePathCharsRegExp,
  hasWindowsTrailingChars,
  isValidationMessageHolder,
  isWindowsReservedName,
  OBSIDIAN_UNSAFE_FILENAME_CHARS,
  trimWindowsTrailingChars,
  UNIX_UNSAFE_PATH_CHARS,
  WINDOWS_UNSAFE_PATH_CHARS
} from './validation.ts';

describe('isValidationMessageHolder', () => {
  it.each([
    { description: 'an object with a validationMessage property', value: { validationMessage: 'error' } },
    { description: 'an object with an empty validationMessage', value: { validationMessage: '' } }
  ])('should return true for $description', ({ value }) => {
    expect(isValidationMessageHolder(value)).toBe(true);
  });

  it.each([
    { description: 'an object without a validationMessage property', value: { other: 'value' } },
    { description: 'a string', value: 'hello' },
    { description: 'a number', value: 42 },
    { description: 'an empty object', value: {} },
    { description: 'an object with validationMessage as undefined', value: { validationMessage: undefined } }
  ])('should return false for $description', ({ value }) => {
    expect(isValidationMessageHolder(value)).toBe(false);
  });

  it('should throw when given null', () => {
    expect(() => isValidationMessageHolder(null)).toThrow();
  });

  it('should throw when given undefined', () => {
    expect(() => isValidationMessageHolder(undefined)).toThrow();
  });
});

describe('OBSIDIAN_UNSAFE_FILENAME_CHARS', () => {
  it.each(['#', '^', '[', ']', '|'])('should match the "%s" character', (char) => {
    expect(char.match(OBSIDIAN_UNSAFE_FILENAME_CHARS)).not.toBeNull();
  });

  it('should not match safe characters', () => {
    expect('abcABC123.-_ '.match(OBSIDIAN_UNSAFE_FILENAME_CHARS)).toBeNull();
  });

  it('should find all unsafe characters in a string', () => {
    const matches = 'file#name[with]^pipes|here'.match(OBSIDIAN_UNSAFE_FILENAME_CHARS);
    expect(matches).toHaveLength(5);
  });
});

describe('WINDOWS_UNSAFE_PATH_CHARS', () => {
  it.each(['*', '\\', '/', '<', '>', ':', '|', '?', '"'])('should match the "%s" character', (char) => {
    expect(char.match(WINDOWS_UNSAFE_PATH_CHARS)).not.toBeNull();
  });

  it('should not match safe characters', () => {
    expect('abcABC123.-_ '.match(WINDOWS_UNSAFE_PATH_CHARS)).toBeNull();
  });
});

describe('UNIX_UNSAFE_PATH_CHARS', () => {
  it('should match the null character', () => {
    expect('\0'.match(UNIX_UNSAFE_PATH_CHARS)).not.toBeNull();
  });

  it('should match a forward slash', () => {
    expect('/'.match(UNIX_UNSAFE_PATH_CHARS)).not.toBeNull();
  });

  it('should not match safe characters including backslash', () => {
    expect('abcABC123.-_ \\'.match(UNIX_UNSAFE_PATH_CHARS)).toBeNull();
  });
});

describe('getOsUnsafePathCharsRegExp', () => {
  it.each(['*', ':', '"'])('should match "%s" when isWindows is true', (char) => {
    const regex = getOsUnsafePathCharsRegExp(true);
    expect(char.match(regex)).not.toBeNull();
  });

  it('should match "/" when isWindows is false', () => {
    const regex = getOsUnsafePathCharsRegExp(false);
    expect('/'.match(regex)).not.toBeNull();
  });

  it('should match null character when isWindows is false', () => {
    const regex = getOsUnsafePathCharsRegExp(false);
    expect('\0'.match(regex)).not.toBeNull();
  });

  it('should not match backslash when isWindows is false', () => {
    const regex = getOsUnsafePathCharsRegExp(false);
    expect('\\'.match(regex)).toBeNull();
  });

  it('should not match safe filenames on Windows', () => {
    const regex = getOsUnsafePathCharsRegExp(true);
    expect('my-file.txt'.match(regex)).toBeNull();
  });

  it('should not match safe filenames on Unix', () => {
    const regex = getOsUnsafePathCharsRegExp(false);
    expect('my-file.txt'.match(regex)).toBeNull();
  });
});

describe('getOsAndObsidianUnsafePathCharsRegExp', () => {
  it.each(['#', '^', '[', ']', '|'])('should match Obsidian-specific char "%s" on Windows', (char) => {
    const regex = getOsAndObsidianUnsafePathCharsRegExp(true);
    expect(char.match(regex)).not.toBeNull();
  });

  it.each(['*', ':', '"', '?'])('should match OS-specific char "%s" on Windows', (char) => {
    const regex = getOsAndObsidianUnsafePathCharsRegExp(true);
    expect(char.match(regex)).not.toBeNull();
  });

  it.each(['#', '^', '['])('should match Obsidian-specific char "%s" on Unix', (char) => {
    const regex = getOsAndObsidianUnsafePathCharsRegExp(false);
    expect(char.match(regex)).not.toBeNull();
  });

  it('should match forward slash on Unix', () => {
    const regex = getOsAndObsidianUnsafePathCharsRegExp(false);
    expect('/'.match(regex)).not.toBeNull();
  });

  it('should not match safe characters on Windows', () => {
    const regexWin = getOsAndObsidianUnsafePathCharsRegExp(true);
    expect('abcABC123.- '.match(regexWin)).toBeNull();
  });

  it('should not match safe characters on Unix', () => {
    const regexUnix = getOsAndObsidianUnsafePathCharsRegExp(false);
    expect('abcABC123.- '.match(regexUnix)).toBeNull();
  });
});

describe('isWindowsReservedName', () => {
  it.each(['CON', 'NUL', 'PRN', 'AUX', 'COM1', 'COM9', 'LPT1', 'LPT9', 'con', 'CoN'])('should reserve the bare device name "%s"', (name) => {
    expect(isWindowsReservedName(name)).toBe(true);
  });

  it.each(['con.md', 'COM1.md', 'LPT9.txt', 'NUL.png'])('should reserve "%s" despite its extension', (name) => {
    expect(isWindowsReservedName(name)).toBe(true);
  });

  // Windows strips trailing dots and spaces before deciding, so these spellings are reserved too.
  it.each(['CON ', 'CON.', 'nul. ', 'COM1.md ', 'CON   '])('should reserve "%s" despite its trailing dots and spaces', (name) => {
    expect(isWindowsReservedName(name)).toBe(true);
  });

  it.each(['contract.md', 'CONtract', 'my CON', 'CON1', 'COM0', 'COM10', 'LPT0', 'ordinary note.md', ''])('should not reserve "%s"', (name) => {
    expect(isWindowsReservedName(name)).toBe(false);
  });

  // Accepted by every Windows version that runs Obsidian, so matching them would rename files that work.
  it.each(['CONIN$', 'CONOUT$', 'CONOUT$.md', 'COM¹', 'COM²', 'COM³'])('should not reserve "%s"', (name) => {
    expect(isWindowsReservedName(name)).toBe(false);
  });

  // Only the last extension is dropped, so the device name is no longer the whole of what remains.
  it('should not reserve a device name carrying two extensions', () => {
    expect(isWindowsReservedName('CON.x.md')).toBe(false);
  });

  it('should not reserve a dotfile, which has no extension to drop', () => {
    expect(isWindowsReservedName('.hidden')).toBe(false);
  });

  it('should answer the same on consecutive calls', () => {
    expect(isWindowsReservedName('CON')).toBe(true);
    expect(isWindowsReservedName('CON')).toBe(true);
  });
});

describe('hasWindowsTrailingChars', () => {
  it.each(['draft ', 'draft.', 'draft. ', 'draft .', ' ', '.', '...'])('should report "%s" as ending with a dot or a space', (name) => {
    expect(hasWindowsTrailingChars(name)).toBe(true);
  });

  it.each(['draft', 'a.b', ' draft', '.hidden', ''])('should not report "%s"', (name) => {
    expect(hasWindowsTrailingChars(name)).toBe(false);
  });

  it('should answer the same on consecutive calls', () => {
    expect(hasWindowsTrailingChars('draft ')).toBe(true);
    expect(hasWindowsTrailingChars('draft ')).toBe(true);
  });
});

describe('trimWindowsTrailingChars', () => {
  it.each([
    { expected: 'draft', name: 'draft. ' },
    { expected: 'draft', name: 'draft' },
    { expected: 'a.b', name: 'a.b.' },
    { expected: ' draft', name: ' draft ' },
    { expected: '', name: '...' },
    { expected: '', name: '' }
  ])('should trim "$name" to "$expected"', ({ expected, name }) => {
    expect(trimWindowsTrailingChars(name)).toBe(expected);
  });
});
