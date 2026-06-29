// @vitest-environment jsdom

import {
  describe,
  expect,
  it
} from 'vitest';

import { assertNonNullable } from '../type-guards.ts';
import { appendCodeBlock } from './html-element.ts';

describe('appendCodeBlock', () => {
  it('should append a strong.markdown-rendered.code wrapping a code element with the text', () => {
    const el = createDiv();
    appendCodeBlock(el, 'console.log("hello")');
    const strong = el.querySelector('strong');
    assertNonNullable(strong);
    expect(strong.className).toBe('markdown-rendered code');
    const code = strong.querySelector('code');
    assertNonNullable(code);
    expect(code.textContent).toBe('console.log("hello")');
  });

  it('should work on a DocumentFragment', () => {
    const fragment = createFragment();
    appendCodeBlock(fragment, 'const x = 42;');
    expect(fragment.querySelector('code')?.textContent).toBe('const x = 42;');
  });
});
