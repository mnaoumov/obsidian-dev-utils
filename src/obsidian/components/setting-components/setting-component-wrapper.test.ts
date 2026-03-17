// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { ensureWrapped } from './setting-component-wrapper.ts';

vi.mock('../../../css-class.ts', () => ({
  CssClass: {
    SettingComponentWrapper: 'setting-component-wrapper'
  }
}));

vi.mock('../../../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('ensureWrapped', () => {
  it('should return existing wrapper if parent already has the CSS class', () => {
    const parent = createDiv();
    parent.classList.add('setting-component-wrapper');
    const child = createSpan();
    parent.appendChild(child);

    const result = ensureWrapped(child);
    expect(result).toBe(parent);
  });

  it('should create a new wrapper and move children into it', () => {
    const grandparent = createDiv();
    const child1 = createSpan();
    const child2 = createEl('input');
    grandparent.appendChild(child1);
    grandparent.appendChild(child2);

    const wrapper = ensureWrapped(child1);
    expect(wrapper.tagName).toBe('DIV');
    expect(wrapper.parentElement).toBe(grandparent);
    expect(wrapper.contains(child1)).toBe(true);
    expect(wrapper.contains(child2)).toBe(true);
  });

  it('should throw if element has no parent', () => {
    const orphan = createDiv();
    expect(() => ensureWrapped(orphan)).toThrow('Element must be attached to the DOM');
  });
});
