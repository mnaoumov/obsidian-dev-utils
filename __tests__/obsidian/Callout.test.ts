// @vitest-environment jsdom
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  CalloutMode,
  wrapForCallout
} from '../../src/obsidian/Callout.ts';

describe('wrapForCallout', () => {
  it('should wrap a single line with blockquote prefix', () => {
    expect(wrapForCallout('hello')).toBe('> hello');
  });

  it('should wrap multiple lines with blockquote prefix on each line', () => {
    expect(wrapForCallout('line1\nline2\nline3')).toBe('> line1\n> line2\n> line3');
  });

  it('should handle an empty string by returning a single blockquote prefix', () => {
    expect(wrapForCallout('')).toBe('> ');
  });

  it('should handle a string with only a newline', () => {
    expect(wrapForCallout('\n')).toBe('> \n> ');
  });

  it('should handle content that already has blockquote prefixes', () => {
    expect(wrapForCallout('> nested')).toBe('> > nested');
  });

  it('should preserve leading and trailing whitespace within lines', () => {
    expect(wrapForCallout('  indented  ')).toBe('>   indented  ');
  });

  it('should handle multiple empty lines', () => {
    expect(wrapForCallout('\n\n')).toBe('> \n> \n> ');
  });

  it('should wrap multiline markdown content', () => {
    const content = '# Heading\n\nSome paragraph text.\n- item 1\n- item 2';
    const expected = '> # Heading\n> \n> Some paragraph text.\n> - item 1\n> - item 2';
    expect(wrapForCallout(content)).toBe(expected);
  });
});

describe('CalloutMode', () => {
  it('should have a Default mode with value 0', () => {
    expect(CalloutMode.Default).toBe(0);
  });

  it('should have a FoldableCollapsed mode with value 1', () => {
    expect(CalloutMode.FoldableCollapsed).toBe(1);
  });

  it('should have a FoldableExpanded mode with value 2', () => {
    expect(CalloutMode.FoldableExpanded).toBe(2);
  });
});
