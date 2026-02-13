import type { MarkdownView } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { getFullContentHtml } from '../../src/obsidian/MarkdownView.ts';

function createMockView(html: string): MarkdownView {
  const measure = vi.fn();
  return {
    contentEl: { innerHTML: html },
    editor: {
      cm: {
        measure,
        viewState: { printing: false }
      }
    }
  } as unknown as MarkdownView;
}

describe('getFullContentHtml', () => {
  it('should return the innerHTML of contentEl', () => {
    const view = createMockView('<p>Hello</p>');
    expect(getFullContentHtml(view)).toBe('<p>Hello</p>');
  });

  it('should set printing to true then back to false', () => {
    const view = createMockView('<div>content</div>');
    const cm = view.editor.cm;
    getFullContentHtml(view);
    expect(cm.viewState.printing).toBe(false);
  });

  it('should call measure twice', () => {
    const view = createMockView('<div>content</div>');
    const cm = view.editor.cm;
    getFullContentHtml(view);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- It's a mock.
    expect(cm.measure).toHaveBeenCalledTimes(2);
  });

  it('should return empty string for empty content', () => {
    const view = createMockView('');
    expect(getFullContentHtml(view)).toBe('');
  });
});
