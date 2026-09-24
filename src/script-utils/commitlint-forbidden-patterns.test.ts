import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  forbiddenPatternsPlugin,
  NO_FORBIDDEN_PATTERNS_RULE_NAME,
  noForbiddenPatternsRule
} from './commitlint-forbidden-patterns.ts';

const { mockReadForbiddenPatterns } = vi.hoisted(() => ({
  mockReadForbiddenPatterns: vi.fn<() => Promise<RegExp[]>>()
}));

vi.mock('./forbidden-patterns.ts', async (importOriginal) => ({
  ...await importOriginal<typeof import('./forbidden-patterns.ts')>(),
  readForbiddenPatterns: mockReadForbiddenPatterns
}));

type Commit = Parameters<typeof noForbiddenPatternsRule>[0];

function makeCommit(parts: Partial<Pick<Commit, 'body' | 'footer' | 'header'>>): Commit {
  return {
    body: null,
    footer: null,
    header: null,
    ...parts
  } as Commit;
}

describe('noForbiddenPatternsRule', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should pass when no pattern is configured', async () => {
    mockReadForbiddenPatterns.mockResolvedValue([]);
    await expect(noForbiddenPatternsRule(makeCommit({ body: 'SECRET-1 here', header: 'fix: thing' }))).resolves.toEqual([true]);
  });

  it('should pass a message that matches nothing', async () => {
    mockReadForbiddenPatterns.mockResolvedValue([/\bSECRET-\d+\b/]);
    await expect(noForbiddenPatternsRule(makeCommit({ body: 'plain words', footer: 'Refs: #12', header: 'fix: thing' }))).resolves.toEqual([true]);
  });

  it.each(
    [
      ['header', { header: 'fix: SECRET-1 thing' }, 'fix: SECRET-1 thing'],
      ['body', { body: 'first line\nSECRET-22. opens this one', header: 'fix: thing' }, 'SECRET-22. opens this one'],
      ['footer', { footer: 'Refs: SECRET-333', header: 'fix: thing' }, 'Refs: SECRET-333']
    ] as const
  )('should refuse a match in the %s, naming the line and the match', async (_part, parts, line) => {
    mockReadForbiddenPatterns.mockResolvedValue([/\bSECRET-\d+\b/]);
    const [isValid, message] = await noForbiddenPatternsRule(makeCommit(parts));
    expect(isValid).toBe(false);
    expect(message).toContain('FORBIDDEN_PATTERNS_FILE');
    expect(message).toContain(`${line}    <- ${/SECRET-\d+/.exec(line)?.[0] ?? ''}`);
  });

  it('should propagate a configured but unreadable list', async () => {
    mockReadForbiddenPatterns.mockRejectedValue(new Error('cannot be read'));
    await expect(noForbiddenPatternsRule(makeCommit({ header: 'fix: thing' }))).rejects.toThrow('cannot be read');
  });
});

describe('forbiddenPatternsPlugin', () => {
  it('should register the rule under its name', () => {
    expect(forbiddenPatternsPlugin.rules[NO_FORBIDDEN_PATTERNS_RULE_NAME]).toBe(noForbiddenPatternsRule);
  });
});
