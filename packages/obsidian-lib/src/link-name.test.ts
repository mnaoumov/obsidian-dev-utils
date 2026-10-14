import {
  describe,
  expect,
  it
} from 'vitest';

import { normalizeLinkName } from './link-name.ts';

describe('normalizeLinkName', () => {
  it('should lowercase the name', () => {
    expect(normalizeLinkName('Some Alias')).toBe('some alias');
  });

  it('should collapse runs of two or more spaces into one', () => {
    expect(normalizeLinkName('some  alias   here')).toBe('some alias here');
  });

  it('should treat differently spaced and cased names as the same', () => {
    expect(normalizeLinkName('Some  Alias')).toBe(normalizeLinkName('some alias'));
  });

  it('should keep a single space, leading and trailing spaces included', () => {
    expect(normalizeLinkName(' a b ')).toBe(' a b ');
  });

  it('should not collapse tabs or other whitespace', () => {
    expect(normalizeLinkName('a\t\tb')).toBe('a\t\tb');
  });
});
