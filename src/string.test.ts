import {
  describe,
  expect,
  it
} from 'vitest';

import { noopAsync } from './function.ts';
import { castTo } from './object-utils.ts';
import {
  EMPTY,
  ensureEndsWith,
  ensureLfEndings,
  ensureStartsWith,
  escape,
  getLfNormalizedOffsetToOriginalOffsetMapper,
  hasSingleOccurrence,
  indent,
  insertAt,
  makeValidVariableName,
  normalizeString,
  replace,
  replaceAll,
  replaceAllAsync,
  trimEnd,
  trimStart,
  unescape,
  unindent
} from './string.ts';

describe('EMPTY', () => {
  it('should be an empty string', () => {
    expect(EMPTY).toBe('');
  });
});

describe('ensureEndsWith', () => {
  it('should add the suffix if not already present', () => {
    expect(ensureEndsWith({
      $string: 'hello',
      suffix: '/'
    })).toBe('hello/');
  });

  it('should not add the suffix if already present', () => {
    expect(ensureEndsWith({
      $string: 'hello/',
      suffix: '/'
    })).toBe('hello/');
  });

  it('should handle empty string input', () => {
    expect(ensureEndsWith({
      $string: '',
      suffix: '.txt'
    })).toBe('.txt');
  });

  it('should handle empty suffix', () => {
    expect(ensureEndsWith({
      $string: 'hello',
      suffix: ''
    })).toBe('hello');
  });
});

describe('ensureStartsWith', () => {
  it('should add the prefix if not already present', () => {
    expect(ensureStartsWith({
      $string: 'world',
      prefix: '/'
    })).toBe('/world');
  });

  it('should not add the prefix if already present', () => {
    expect(ensureStartsWith({
      $string: '/world',
      prefix: '/'
    })).toBe('/world');
  });

  it('should handle empty string input', () => {
    expect(ensureStartsWith({
      $string: '',
      prefix: 'pre'
    })).toBe('pre');
  });

  it('should handle empty prefix', () => {
    expect(ensureStartsWith({
      $string: 'hello',
      prefix: ''
    })).toBe('hello');
  });
});

describe('ensureLfEndings', () => {
  it('should replace CRLF with LF', () => {
    expect(ensureLfEndings('line1\r\nline2\r\n')).toBe('line1\nline2\n');
  });

  it('should replace lone CR with LF', () => {
    expect(ensureLfEndings('line1\rline2\r')).toBe('line1\nline2\n');
  });

  it('should leave LF-only strings unchanged', () => {
    expect(ensureLfEndings('line1\nline2\n')).toBe('line1\nline2\n');
  });

  it('should handle mixed line endings', () => {
    expect(ensureLfEndings('a\r\nb\rc\n')).toBe('a\nb\nc\n');
  });

  it('should handle empty string', () => {
    expect(ensureLfEndings('')).toBe('');
  });

  it('should handle string with no line endings', () => {
    expect(ensureLfEndings('hello')).toBe('hello');
  });
});

describe('trimEnd', () => {
  it('should remove the suffix if present', () => {
    expect(trimEnd({
      $string: 'hello.txt',
      suffix: '.txt'
    })).toBe('hello');
  });

  it('should return the string unchanged if suffix is not present', () => {
    expect(trimEnd({
      $string: 'hello',
      suffix: '.txt'
    })).toBe('hello');
  });

  it('should throw when validate is true and suffix is not present', () => {
    expect(() =>
      trimEnd({
        $string: 'hello',
        shouldValidate: true,
        suffix: '.txt'
      })
    ).toThrow('String hello does not end with suffix .txt');
  });

  it('should not throw when validate is true and suffix is present', () => {
    expect(trimEnd({
      $string: 'hello.txt',
      shouldValidate: true,
      suffix: '.txt'
    })).toBe('hello');
  });

  it('should handle empty suffix', () => {
    // Str.endsWith('') is true, so str.slice(0, -0) = str.slice(0, 0) = ''
    expect(trimEnd({
      $string: 'hello',
      suffix: ''
    })).toBe('');
  });

  it('should handle empty string', () => {
    expect(trimEnd({
      $string: '',
      suffix: 'suffix'
    })).toBe('');
  });
});

describe('trimStart', () => {
  it('should remove the prefix if present', () => {
    expect(trimStart({
      $string: '/path/to/file',
      prefix: '/path'
    })).toBe('/to/file');
  });

  it('should return the string unchanged if prefix is not present', () => {
    expect(trimStart({
      $string: 'hello',
      prefix: 'xyz'
    })).toBe('hello');
  });

  it('should throw when validate is true and prefix is not present', () => {
    expect(() =>
      trimStart({
        $string: 'hello',
        prefix: 'xyz',
        shouldValidate: true
      })
    ).toThrow('String hello does not start with prefix xyz');
  });

  it('should not throw when validate is true and prefix is present', () => {
    expect(trimStart({
      $string: '/path',
      prefix: '/',
      shouldValidate: true
    })).toBe('path');
  });

  it('should handle empty prefix', () => {
    expect(trimStart({
      $string: 'hello',
      prefix: ''
    })).toBe('hello');
  });

  it('should handle empty string', () => {
    expect(trimStart({
      $string: '',
      prefix: 'prefix'
    })).toBe('');
  });
});

describe('hasSingleOccurrence', () => {
  it('should return true for exactly one occurrence', () => {
    expect(hasSingleOccurrence({
      $string: 'hello world',
      searchValue: 'world'
    })).toBe(true);
  });

  it('should return false for zero occurrences', () => {
    expect(hasSingleOccurrence({
      $string: 'hello world',
      searchValue: 'xyz'
    })).toBe(false);
  });

  it('should return false for multiple occurrences', () => {
    expect(hasSingleOccurrence({
      $string: 'hello hello',
      searchValue: 'hello'
    })).toBe(false);
  });

  it('should handle empty search value', () => {
    // Empty string is found at every position, so indexOf(0) !== lastIndexOf(end)
    expect(hasSingleOccurrence({
      $string: 'test',
      searchValue: ''
    })).toBe(false);
  });

  it('should handle empty string', () => {
    expect(hasSingleOccurrence({
      $string: '',
      searchValue: 'a'
    })).toBe(false);
  });

  it('should handle single character match', () => {
    expect(hasSingleOccurrence({
      $string: 'a',
      searchValue: 'a'
    })).toBe(true);
  });
});

describe('indent', () => {
  it('should prefix each line with the given prefix', () => {
    expect(indent({
      prefix: '  ',
      text: 'line1\nline2\nline3'
    })).toBe('  line1\n  line2\n  line3');
  });

  it('should handle single line', () => {
    expect(indent({
      prefix: '> ',
      text: 'hello'
    })).toBe('> hello');
  });

  it('should handle empty string', () => {
    expect(indent({
      prefix: '  ',
      text: ''
    })).toBe('  ');
  });

  it('should handle empty prefix', () => {
    expect(indent({
      prefix: '',
      text: 'line1\nline2'
    })).toBe('line1\nline2');
  });
});

describe('unindent', () => {
  it('should remove the prefix from each line', () => {
    expect(unindent({
      prefix: '  ',
      text: '  line1\n  line2\n  line3'
    })).toBe('line1\nline2\nline3');
  });

  it('should leave lines without the prefix unchanged when shouldThrowIfNotIndented is false', () => {
    expect(unindent({
      prefix: '  ',
      text: '  line1\nline2'
    })).toBe('line1\nline2');
  });

  it('should throw when shouldThrowIfNotIndented is true and a line lacks the prefix', () => {
    expect(() =>
      unindent({
        prefix: '  ',
        shouldThrowIfNotIndented: true,
        text: '  line1\nline2'
      })
    ).toThrow('Line "line2" is not indented with "  "');
  });

  it('should handle empty string', () => {
    expect(unindent({
      prefix: '  ',
      text: ''
    })).toBe('');
  });

  it('should handle empty prefix', () => {
    expect(unindent({
      prefix: '',
      text: 'line1\nline2'
    })).toBe('line1\nline2');
  });
});

describe('insertAt', () => {
  it('should insert a substring at the specified position', () => {
    expect(insertAt({
      $string: 'hello world',
      startIndex: 5,
      substring: ' beautiful'
    })).toBe('hello beautiful world');
  });

  it('should insert at the beginning', () => {
    expect(insertAt({
      $string: 'world',
      startIndex: 0,
      substring: 'hello '
    })).toBe('hello world');
  });

  it('should insert at the end', () => {
    expect(insertAt({
      $string: 'hello',
      startIndex: 5,
      substring: ' world'
    })).toBe('hello world');
  });

  it('should replace a range when endIndex is provided', () => {
    expect(insertAt({
      $string: 'hello world',
      endIndex: 11,
      startIndex: 6,
      substring: 'universe'
    })).toBe('hello universe');
  });

  it('should handle replacing with a different length string', () => {
    expect(insertAt({
      $string: 'abcdef',
      endIndex: 4,
      startIndex: 2,
      substring: 'XY'
    })).toBe('abXYef');
  });

  it('should handle empty substring insertion', () => {
    expect(insertAt({
      $string: 'hello',
      startIndex: 3,
      substring: ''
    })).toBe('hello');
  });
});

describe('makeValidVariableName', () => {
  it('should replace non-alphanumeric/underscore characters with underscore', () => {
    expect(makeValidVariableName('hello-world')).toBe('hello_world');
  });

  it('should replace spaces', () => {
    expect(makeValidVariableName('my variable')).toBe('my_variable');
  });

  it('should replace special characters', () => {
    expect(makeValidVariableName('foo.bar@baz!')).toBe('foo_bar_baz_');
  });

  it('should leave valid variable names unchanged', () => {
    expect(makeValidVariableName('valid_name123')).toBe('valid_name123');
  });

  it('should handle empty string', () => {
    expect(makeValidVariableName('')).toBe('');
  });
});

describe('normalizeString', () => {
  it('should replace non-breaking spaces with regular spaces', () => {
    expect(normalizeString('hello\u{A0}world')).toBe('hello world');
  });

  it('should replace narrow non-breaking spaces', () => {
    expect(normalizeString('hello\u{202F}world')).toBe('hello world');
  });

  it('should return NFC-normalized string', () => {
    // E + combining acute accent should become a single character
    const input = 'e\u{301}';
    const result = normalizeString(input);
    expect(result).toBe(input.normalize('NFC'));
  });

  it('should handle empty string', () => {
    expect(normalizeString('')).toBe('');
  });

  it('should handle string with no special characters', () => {
    expect(normalizeString('hello world')).toBe('hello world');
  });
});

describe('escape', () => {
  it('should escape newline', () => {
    expect(escape('\n')).toBe(String.raw`\n`);
  });

  it('should escape carriage return', () => {
    expect(escape('\r')).toBe(String.raw`\r`);
  });

  it('should escape tab', () => {
    expect(escape('\t')).toBe(String.raw`\t`);
  });

  it('should escape backspace', () => {
    expect(escape('\b')).toBe(String.raw`\b`);
  });

  it('should escape form feed', () => {
    expect(escape('\f')).toBe(String.raw`\f`);
  });

  it('should escape single quote', () => {
    expect(escape('\'')).toBe(String.raw`\'`);
  });

  it('should escape double quote', () => {
    expect(escape('"')).toBe(String.raw`\"`);
  });

  it('should escape backslash', () => {
    expect(escape('\\')).toBe('\\\\');
  });

  it('should escape multiple special characters', () => {
    expect(escape('line1\nline2\ttab')).toBe(String.raw`line1\nline2\ttab`);
  });

  it('should leave regular strings unchanged', () => {
    expect(escape('hello world')).toBe('hello world');
  });

  it('should handle empty string', () => {
    expect(escape('')).toBe('');
  });
});

describe('unescape', () => {
  it(String.raw`should unescape \n to newline`, () => {
    expect(unescape(String.raw`\n`)).toBe('\n');
  });

  it(String.raw`should unescape \r to carriage return`, () => {
    expect(unescape(String.raw`\r`)).toBe('\r');
  });

  it(String.raw`should unescape \t to tab`, () => {
    expect(unescape(String.raw`\t`)).toBe('\t');
  });

  it(String.raw`should unescape \b to backspace`, () => {
    expect(unescape(String.raw`\b`)).toBe('\b');
  });

  it(String.raw`should unescape \f to form feed`, () => {
    expect(unescape(String.raw`\f`)).toBe('\f');
  });

  it('should unescape escaped single quote', () => {
    expect(unescape(String.raw`\'`)).toBe('\'');
  });

  it('should unescape escaped double quote', () => {
    expect(unescape(String.raw`\"`)).toBe('"');
  });

  it('should unescape escaped backslash', () => {
    expect(unescape('\\\\')).toBe('\\');
  });

  it('should be the inverse of escape for basic strings', () => {
    const original = 'hello\nworld\ttab\\slash';
    expect(unescape(escape(original))).toBe(original);
  });

  it('should handle empty string', () => {
    expect(unescape('')).toBe('');
  });
});

describe('replace', () => {
  it('should replace multiple strings using a replacements map', () => {
    const result = replace('hello world foo', { foo: 'bar', hello: 'hi', world: 'earth' });
    expect(result).toBe('hi earth bar');
  });

  it('should handle no matches', () => {
    const result = replace('hello world', { xyz: 'abc' });
    expect(result).toBe('hello world');
  });

  it('should handle empty string', () => {
    const result = replace('', { a: 'b' });
    expect(result).toBe('');
  });

  it('should handle special regex characters in keys', () => {
    const result = replace('price is $10.00', { '$10.00': '20 dollars' });
    expect(result).toBe('price is 20 dollars');
  });
});

describe('replaceAll', () => {
  it('should replace all occurrences of a string with another string', () => {
    expect(replaceAll({
      $string: 'aaa',
      replacer: 'b',
      searchValue: 'a'
    })).toBe('bbb');
  });

  it('should replace all occurrences using a regex', () => {
    expect(replaceAll({
      $string: 'hello123world456',
      replacer: 'NUM',
      searchValue: /\d+/g
    })).toBe('helloNUMworldNUM');
  });

  it('should add global flag to regex if missing', () => {
    expect(replaceAll({
      $string: 'aaa',
      replacer: 'b',
      searchValue: /a/
    })).toBe('bbb');
  });

  it('should support function replacer', () => {
    const result = replaceAll({
      $string: 'hello world',
      replacer: ({ substring }) => substring.toUpperCase(),
      searchValue: /\w+/g
    });
    expect(result).toBe('HELLO WORLD');
  });

  it('should pass offset and source in function replacer args', () => {
    const offsets: number[] = [];
    replaceAll({
      $string: 'abab',
      replacer: ({ offset }) => {
        offsets.push(offset);
        return 'x';
      },
      searchValue: 'ab'
    });
    expect(offsets).toEqual([0, 2]);
  });

  it('should handle regex with capture groups', () => {
    const result = replaceAll({
      $string: '2024-01-15',
      replacer: ({ capturedGroupArguments: [year = '', month = '', day = ''] }) => {
        return `${day}/${month}/${year}`;
      },
      searchValue: /(?<Year>\d{4})-(?<Month>\d{2})-(?<Day>\d{2})/g
    });
    expect(result).toBe('15/01/2024');
  });

  it('should return the string unchanged when replacer is undefined', () => {
    expect(replaceAll({
      $string: 'hello',
      replacer: castTo<string>(undefined),
      searchValue: 'x'
    })).toBe('hello');
  });

  it('should handle no matches', () => {
    expect(replaceAll({
      $string: 'hello',
      replacer: 'abc',
      searchValue: 'xyz'
    })).toBe('hello');
  });

  it('should handle empty string', () => {
    expect(replaceAll({
      $string: '',
      replacer: 'b',
      searchValue: 'a'
    })).toBe('');
  });

  it('should return original substring when function replacer returns undefined', () => {
    const result = replaceAll({
      $string: 'abc',
      replacer: () => castTo<string>(undefined),
      searchValue: /./g
    });
    expect(result).toBe('abc');
  });
});

describe('replaceAllAsync', () => {
  it('should replace all occurrences asynchronously with a string replacer', async () => {
    const result = await replaceAllAsync({
      $string: 'aaa',
      replacer: 'b',
      searchValue: 'a'
    });
    expect(result).toBe('bbb');
  });

  it('should replace all occurrences asynchronously with a function replacer', async () => {
    const result = await replaceAllAsync({
      $string: 'hello world',
      replacer: async ({ substring }) => {
        await noopAsync();
        return substring.toUpperCase();
      },
      searchValue: /\w+/g
    });
    expect(result).toBe('HELLO WORLD');
  });

  it('should handle no matches', async () => {
    const result = await replaceAllAsync({
      $string: 'hello',
      replacer: async () => {
        await noopAsync();
        return 'abc';
      },
      searchValue: 'xyz'
    });
    expect(result).toBe('hello');
  });

  it('should throw if abort signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('aborted'));

    await expect(
      replaceAllAsync({
        $string: 'hello',
        abortSignal: controller.signal,
        replacer: 'H',
        searchValue: 'h'
      })
    ).rejects.toThrow();
  });

  it('should handle empty string', async () => {
    const result = await replaceAllAsync({
      $string: '',
      replacer: 'b',
      searchValue: 'a'
    });
    expect(result).toBe('');
  });

  it('should handle undefined replacer', async () => {
    const result = await replaceAllAsync({
      $string: 'foobar',
      replacer: ({ substring }) => {
        if (substring === 'foo') {
          return;
        }

        return 'baz';
      },
      searchValue: /foo|bar/g
    });
    expect(result).toBe('foobaz');
  });
});

describe('getLfNormalizedOffsetToOriginalOffsetMapper', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 5],
    [6, 6]
  ])(String.raw`should return identity mapping for LF-only string "abc\ndef": offset %j -> %j`, (lfOffset, expected) => {
    const mapper = getLfNormalizedOffsetToOriginalOffsetMapper('abc\ndef');
    expect(mapper(lfOffset)).toBe(expected);
  });

  it.each([
    [0, 0],
    [1, 1],
    [2, 3],
    [3, 4],
    [4, 5]
  ])(String.raw`should map CRLF offsets correctly for "ab\r\ncd": offset %j -> %j`, (lfOffset, expected) => {
    const mapper = getLfNormalizedOffsetToOriginalOffsetMapper('ab\r\ncd');
    expect(mapper(lfOffset)).toBe(expected);
  });

  it.each([
    [0, 0],
    [1, 2],
    [2, 3],
    [3, 5],
    [4, 6]
  ])(String.raw`should handle multiple CRLF sequences in "a\r\nb\r\nc": offset %j -> %j`, (lfOffset, expected) => {
    const mapper = getLfNormalizedOffsetToOriginalOffsetMapper('a\r\nb\r\nc');
    expect(mapper(lfOffset)).toBe(expected);
  });

  it.each([
    [-1, -1],
    [-100, -100]
  ])('should return negative offset unchanged: %j -> %j', (lfOffset, expected) => {
    const mapper = getLfNormalizedOffsetToOriginalOffsetMapper('abc');
    expect(mapper(lfOffset)).toBe(expected);
  });

  it.each([
    [5, 6],
    [10, 11]
  ])(String.raw`should handle offset beyond string length for "ab\r\ncd": offset %j -> %j`, (lfOffset, expected) => {
    const mapper = getLfNormalizedOffsetToOriginalOffsetMapper('ab\r\ncd');
    expect(mapper(lfOffset)).toBe(expected);
  });

  it.each([
    [3, 3],
    [10, 10]
  ])('should handle offset beyond length for LF-only string "abc": offset %j -> %j', (lfOffset, expected) => {
    const mapper = getLfNormalizedOffsetToOriginalOffsetMapper('abc');
    expect(mapper(lfOffset)).toBe(expected);
  });

  it.each([
    [0, 0],
    [5, 5],
    [-1, -1]
  ])('should handle empty string: offset %j -> %j', (lfOffset, expected) => {
    const mapper = getLfNormalizedOffsetToOriginalOffsetMapper('');
    expect(mapper(lfOffset)).toBe(expected);
  });

  it('should handle string with only CRLF', () => {
    const mapper = getLfNormalizedOffsetToOriginalOffsetMapper('\r\n');
    expect(mapper(0)).toBe(1);
  });
});

describe('replaceAll - missingGroupIndices and named groups', () => {
  it('should populate missingGroupIndices for undefined capture groups', () => {
    const missingIndices: number[] = [];
    // Regex with optional groups: one matches, one does not
    replaceAll({
      $string: 'test',
      replacer: ({ missingGroupIndices, substring }) => {
        missingIndices.push(...missingGroupIndices);
        return substring;
      },
      searchValue: /(?:(?<Group1>x)|(?<Group2>t))/g
    });
    expect(missingIndices).toEqual([0, 0]);
  });

  it('should pass named groups when regex has named capture groups', () => {
    const capturedGroups: (Record<string, string | undefined> | undefined)[] = [];
    replaceAll({
      $string: '2024-01-15',
      replacer: (common) => {
        capturedGroups.push(common.groups);
        return common.substring;
      },
      searchValue: /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/g
    });
    expect(capturedGroups).toEqual([{ day: '15', month: '01', year: '2024' }]);
  });

  it('should set groups to undefined when regex has no named groups', () => {
    const capturedGroups: (Record<string, string | undefined> | undefined)[] = [];
    replaceAll({
      $string: 'abc',
      replacer: (common) => {
        capturedGroups.push(common.groups);
        return common.substring;
      },
      searchValue: /(?:.)/g
    });
    expect(capturedGroups).toEqual([undefined, undefined, undefined]);
  });

  it('should have empty missingGroupIndices when all groups match', () => {
    const missingIndices: number[][] = [];
    replaceAll({
      $string: 'ab',
      replacer: (common) => {
        missingIndices.push([...common.missingGroupIndices]);
        return common.substring;
      },
      searchValue: /(?<Group1>a)(?<Group2>b)/g
    });
    expect(missingIndices).toEqual([[]]);
  });
});
