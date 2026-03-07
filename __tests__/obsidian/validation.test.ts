// @vitest-environment jsdom
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  getOsAndObsidianUnsafePathCharsRegExp,
  getOsUnsafePathCharsRegExp,
  isValidationMessageHolder,
  OBSIDIAN_UNSAFE_FILENAME_CHARS,
  UNIX_UNSAFE_PATH_CHARS,
  WINDOWS_UNSAFE_PATH_CHARS
} from '../../src/obsidian/validation.ts';

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
