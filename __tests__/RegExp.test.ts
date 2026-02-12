import {
  describe,
  expect,
  it
} from 'vitest';

import {
  ALWAYS_MATCH_REG_EXP,
  escapeRegExp,
  isValidRegExp,
  NEVER_MATCH_REG_EXP,
  oneOf,
  RegExpMergeFlagsConflictStrategy
} from '../src/RegExp.ts';

describe('escapeRegExp', () => {
  it('should escape all special regex characters', () => {
    const special = '.*+?^${}()|[]\\';
    const escaped = escapeRegExp(special);
    expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it.each(['hello world', 'abc123', ''])('should return normal string unchanged: %j', (input) => {
    expect(escapeRegExp(input)).toBe(input);
  });

  it('should produce a pattern that matches the original literal string', () => {
    const literal = 'foo.bar(baz)+';
    const pattern = new RegExp(escapeRegExp(literal));
    expect(pattern.test(literal)).toBe(true);
  });

  it('should produce a pattern that does not match a modified string', () => {
    const literal = 'foo.bar(baz)+';
    const pattern = new RegExp(escapeRegExp(literal));
    expect(pattern.test('fooXbar(baz)+')).toBe(false);
  });
});

describe('isValidRegExp', () => {
  it.each(['abc', '.*', '^foo$', '[a-z]+', '(?:group)', ''])('should return true for valid pattern: %j', (pattern) => {
    expect(isValidRegExp(pattern)).toBe(true);
  });

  it.each(['[', '(?<', '*', '(?P<name)'])('should return false for invalid pattern: %j', (pattern) => {
    expect(isValidRegExp(pattern)).toBe(false);
  });
});

describe('ALWAYS_MATCH_REG_EXP', () => {
  it.each(['', 'hello', 'anything at all'])('should match any string: %j', (input) => {
    expect(ALWAYS_MATCH_REG_EXP.test(input)).toBe(true);
  });
});

describe('NEVER_MATCH_REG_EXP', () => {
  it.each(['', 'hello', 'anything at all', '\n'])('should not match any string: %j', (input) => {
    expect(NEVER_MATCH_REG_EXP.test(input)).toBe(false);
  });
});

describe('oneOf', () => {
  it('should return ALWAYS_MATCH_REG_EXP for an empty array', () => {
    const result = oneOf([]);
    expect(result).toBe(ALWAYS_MATCH_REG_EXP);
  });

  it('should return the same regex for a single-element array', () => {
    const single = /foo/i;
    const result = oneOf([single]);
    expect(result).toBe(single);
  });

  it('should combine multiple regexes with correct alternation source', () => {
    const result = oneOf([/abc/, /def/, /ghi/]);
    expect(result.source).toBe('(?:abc)|(?:def)|(?:ghi)');
  });

  it.each(['abc', 'def', 'ghi'])('should match %j when combining /abc/, /def/, /ghi/', (input) => {
    const result = oneOf([/abc/, /def/, /ghi/]);
    expect(result.test(input)).toBe(true);
  });

  it('should not match xyz when combining /abc/, /def/, /ghi/', () => {
    const result = oneOf([/abc/, /def/, /ghi/]);
    expect(result.test('xyz')).toBe(false);
  });

  describe('Throw strategy (default)', () => {
    it('should pass when all regexes have the same semantic flags', () => {
      const result = oneOf([/abc/i, /def/i]);
      expect(result.flags).toContain('i');
    });

    it('should pass when no regexes have a given semantic flag', () => {
      const result = oneOf([/abc/, /def/]);
      expect(result.flags).toBe('');
    });

    it('should throw on conflicting semantic flags', () => {
      expect(() => oneOf([/abc/i, /def/])).toThrow('Conflicting flag \'i\' across patterns.');
    });

    it('should throw on conflicting m flag', () => {
      expect(() => oneOf([/abc/m, /def/])).toThrow('Conflicting flag \'m\' across patterns.');
    });

    it('should throw on conflicting u/v flags across patterns', () => {
      expect(() => oneOf([/abc/u, /def/])).toThrow('Conflicting \'u\'/\'v\' flags across patterns.');
    });

    it('should throw when both u and v are uniformly present', () => {
      expect(() => oneOf([/abc/u, /def/v])).toThrow();
    });
  });

  describe('Intersect strategy', () => {
    it('should keep the i flag when present in all regexes', () => {
      const result = oneOf([/abc/im, /def/i], RegExpMergeFlagsConflictStrategy.Intersect);
      expect(result.flags).toContain('i');
    });

    it('should drop the m flag when not present in all regexes', () => {
      const result = oneOf([/abc/im, /def/i], RegExpMergeFlagsConflictStrategy.Intersect);
      expect(result.flags).not.toContain('m');
    });

    it('should drop i flag if not shared by all regexes', () => {
      const result = oneOf([/abc/i, /def/m], RegExpMergeFlagsConflictStrategy.Intersect);
      expect(result.flags).not.toContain('i');
    });

    it('should drop m flag if not shared by all regexes', () => {
      const result = oneOf([/abc/i, /def/m], RegExpMergeFlagsConflictStrategy.Intersect);
      expect(result.flags).not.toContain('m');
    });

    it.each(['i', 'm', 's'])('should keep %s flag when all regexes share it', (flag) => {
      const result = oneOf([/abc/ims, /def/ims], RegExpMergeFlagsConflictStrategy.Intersect);
      expect(result.flags).toContain(flag);
    });
  });

  describe('Union strategy', () => {
    it.each(['i', 'm'])('should keep %s flag when present in at least one regex', (flag) => {
      const result = oneOf([/abc/i, /def/m], RegExpMergeFlagsConflictStrategy.Union);
      expect(result.flags).toContain(flag);
    });

    it.each(['i', 'm', 's'])('should include %s flag when combining /abc/i and /def/ms', (flag) => {
      const result = oneOf([/abc/i, /def/ms], RegExpMergeFlagsConflictStrategy.Union);
      expect(result.flags).toContain(flag);
    });
  });

  describe('meta flags', () => {
    it('should always union the g flag', () => {
      const result = oneOf([/abc/g, /def/], RegExpMergeFlagsConflictStrategy.Throw);
      expect(result.flags).toContain('g');
    });

    it('should always union the d flag', () => {
      const result = oneOf([/abc/d, /def/], RegExpMergeFlagsConflictStrategy.Throw);
      expect(result.flags).toContain('d');
    });
  });

  describe('unicode flag handling', () => {
    it('should keep u flag when all regexes have it', () => {
      const result = oneOf([/abc/u, /def/u]);
      expect(result.flags).toContain('u');
    });

    it('should keep v flag when all regexes have it', () => {
      const result = oneOf([/abc/v, /def/v]);
      expect(result.flags).toContain('v');
    });

    it('should resolve u+v conflict in Union strategy by keeping v', () => {
      const result = oneOf([/abc/u, /def/v], RegExpMergeFlagsConflictStrategy.Union);
      expect(result.flags).toContain('v');
    });

    it('should resolve u+v conflict in Union strategy by dropping u', () => {
      const result = oneOf([/abc/u, /def/v], RegExpMergeFlagsConflictStrategy.Union);
      expect(result.flags).not.toContain('u');
    });

    it('should drop u in Intersect when not all share it', () => {
      const result = oneOf([/abc/u, /def/v], RegExpMergeFlagsConflictStrategy.Intersect);
      expect(result.flags).not.toContain('u');
    });

    it('should drop v in Intersect when not all share it', () => {
      const result = oneOf([/abc/u, /def/v], RegExpMergeFlagsConflictStrategy.Intersect);
      expect(result.flags).not.toContain('v');
    });
  });
});
