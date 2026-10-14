import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  findForbiddenPatternMatches,
  readForbiddenPatterns
} from './forbidden-patterns.ts';

const { mockLoadEnvFileIfExists, mockReadFile } = vi.hoisted(() => ({
  mockLoadEnvFileIfExists: vi.fn(),
  mockReadFile: vi.fn<(path: string, encoding: string) => Promise<string>>()
}));

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:fs/promises')>(),
  readFile: mockReadFile
}));

vi.mock('./env-toggle.ts', () => ({
  loadEnvFileIfExists: mockLoadEnvFileIfExists
}));

describe('readForbiddenPatterns', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should load .env before reading the variable', async () => {
    vi.stubEnv('FORBIDDEN_PATTERNS_FILE', undefined);
    await readForbiddenPatterns();
    expect(mockLoadEnvFileIfExists).toHaveBeenCalled();
  });

  it.each([undefined, '', ' '.repeat(3)])('should yield no patterns and read nothing when the variable is %j', async (value) => {
    vi.stubEnv('FORBIDDEN_PATTERNS_FILE', value);
    await expect(readForbiddenPatterns()).resolves.toEqual([]);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('should throw when the named file cannot be read', async () => {
    vi.stubEnv('FORBIDDEN_PATTERNS_FILE', '/private/patterns.txt');
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    await expect(readForbiddenPatterns()).rejects.toThrow('FORBIDDEN_PATTERNS_FILE names /private/patterns.txt, which cannot be read.');
  });

  it('should compile plain lines and literals, skipping blanks and comments', async () => {
    vi.stubEnv('FORBIDDEN_PATTERNS_FILE', ' /private/patterns.txt ');
    mockReadFile.mockResolvedValue('# a comment\r\n\r\n\\bSECRET-\\d+\\b\n  /\\bhidden\\b/giy  \n/plain/\n');
    const patterns = await readForbiddenPatterns();
    expect(mockReadFile).toHaveBeenCalledWith('/private/patterns.txt', 'utf-8');
    expect(patterns.map((pattern) => [pattern.source, pattern.flags])).toEqual([
      [String.raw`\bSECRET-\d+\b`, ''],
      [String.raw`\bhidden\b`, 'i'],
      ['plain', '']
    ]);
  });

  it('should name the line that is not a valid regular expression', async () => {
    vi.stubEnv('FORBIDDEN_PATTERNS_FILE', '/private/patterns.txt');
    mockReadFile.mockResolvedValue('# a comment\n(unclosed\n');
    await expect(readForbiddenPatterns()).rejects.toThrow('Line 2 of the forbidden-patterns file /private/patterns.txt is not a valid regular expression.');
  });
});

describe('findForbiddenPatternMatches', () => {
  it('should report each offending line once, with the first pattern that matched', () => {
    const text = '- fix: SECRET-1 and hidden\r\n- feat: clean\n- chore: HIDDEN';
    expect(findForbiddenPatternMatches(text, [/SECRET-\d+/, /hidden/i])).toEqual([
      { line: '- fix: SECRET-1 and hidden', match: 'SECRET-1' },
      { line: '- chore: HIDDEN', match: 'HIDDEN' }
    ]);
  });

  it('should find nothing without patterns', () => {
    expect(findForbiddenPatternMatches('- fix: SECRET-1', [])).toEqual([]);
  });
});
