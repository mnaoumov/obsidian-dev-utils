// @vitest-environment jsdom

import {
  describe,
  expect,
  it
} from 'vitest';

import {
  getMandatoryNamedGroup,
  getOptionalNamedGroup
} from '../reg-exp.ts';
import { createCodeBlockRegExp } from './code-block-reg-exp.ts';

interface ParsedCodeBlock {
  content: null | string;
  language: string;
}

function parseCodeBlocks(text: string): ParsedCodeBlock[] {
  return Array.from(text.matchAll(createCodeBlockRegExp())).map((match) => ({
    content: getOptionalNamedGroup(match, 'CodeBlockContent'),
    language: getMandatoryNamedGroup(match, 'CodeBlockLanguage')
  }));
}

describe('createCodeBlockRegExp', () => {
  it('returns a fresh global instance on each call', () => {
    const first = createCodeBlockRegExp();
    const second = createCodeBlockRegExp();
    expect(first).not.toBe(second);
    expect(first.global).toBe(true);
    expect(first.source).toBe(second.source);
  });

  it('matches a basic fenced code block', () => {
    expect(parseCodeBlocks(['```js', 'a', 'b', '```'].join('\n'))).toEqual([
      { content: 'a\nb', language: 'js' }
    ]);
  });

  it('captures the language and content of a code-button block', () => {
    const note = ['```code-button', '---', 'shouldAutoRun: true', '---', 'console.log("hello");', '```'].join('\n');
    expect(parseCodeBlocks(note)).toEqual([
      { content: '---\nshouldAutoRun: true\n---\nconsole.log("hello");', language: 'code-button' }
    ]);
  });

  it('matches blocks nested in callouts at any depth', () => {
    expect(parseCodeBlocks(['> ```js', '> a', '> b', '> ```'].join('\n'))).toEqual([
      { content: '> a\n> b', language: 'js' }
    ]);
    expect(parseCodeBlocks(['> > ```js', '> > a', '> > ```'].join('\n'))).toEqual([
      { content: '> > a', language: 'js' }
    ]);
    expect(parseCodeBlocks(['> > > ```js', '> > > a', '> > > ```'].join('\n'))).toEqual([
      { content: '> > > a', language: 'js' }
    ]);
  });

  it('matches tilde fences', () => {
    expect(parseCodeBlocks(['~~~js', 'a', '~~~'].join('\n'))).toEqual([
      { content: 'a', language: 'js' }
    ]);
  });

  it('treats adjacent fences as a block with no content', () => {
    expect(parseCodeBlocks(['```', '```'].join('\n'))).toEqual([
      { content: null, language: '' }
    ]);
  });

  // These inputs trigger catastrophic backtracking (a synchronous freeze) with the old content pattern.
  // A fence-open with no valid closing fence before EOF, where the line prefix can recur within a line.
  // Each test must simply COMPLETE; a re-hang surfaces as a test timeout.
  // See the CodeScript Toolkit freeze report (issue #56).
  describe('does not backtrack catastrophically on unterminated blocks', () => {
    const LINE_COUNT = 40;

    it('terminates on the issue #56 reproduction (empty code block + unterminated trailing text)', () => {
      const note = [
        '```code-button',
        '---',
        'shouldAutoRun: true',
        '---',
        'console.log("hello");',
        '```',
        '',
        '```',
        '',
        '```',
        '',
        'some text',
        'some text',
        'some text'
      ].join('\n');
      const blocks = parseCodeBlocks(note);
      expect(blocks[0]).toEqual({ content: '---\nshouldAutoRun: true\n---\nconsole.log("hello");', language: 'code-button' });
    });

    it('terminates on a space-indented fence-open with many unterminated lines', () => {
      const note = ['   ```js', ...Array.from({ length: LINE_COUNT }, () => '   a   b   c')].join('\n');
      expect(parseCodeBlocks(note)).toEqual([]);
    });

    it('terminates on a callout fence-open with a recurring mid-line prefix', () => {
      const note = ['> ```js', ...Array.from({ length: LINE_COUNT }, () => '> a > b > c')].join('\n');
      expect(parseCodeBlocks(note)).toEqual([]);
    });
  });

  describe('invalid syntax', () => {
    it('returns no match for an unterminated fence', () => {
      expect(parseCodeBlocks(['```js', 'a', 'b', 'c'].join('\n'))).toEqual([]);
    });

    it('returns no match for an unterminated code-button block', () => {
      const note = ['```code-button', '---', 'shouldAutoRun: true', '---', 'console.log("hello");'].join('\n');
      expect(parseCodeBlocks(note)).toEqual([]);
    });
  });
});
