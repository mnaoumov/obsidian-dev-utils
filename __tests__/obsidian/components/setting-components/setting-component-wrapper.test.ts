// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { ensureWrapped } from '../../../../src/obsidian/components/setting-components/setting-component-wrapper.ts';

vi.mock('../../../../src/css-class.ts', () => ({
  CssClass: {
    SettingComponentWrapper: 'setting-component-wrapper'
  }
}));

vi.mock('../../../../src/obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('ensureWrapped', () => {
  it('should return existing wrapper if parent already has the CSS class', () => {
    const parent = document.createElement('div');
    parent.classList.add('setting-component-wrapper');
    const child = document.createElement('span');
    parent.appendChild(child);

    const result = ensureWrapped(child);
    expect(result).toBe(parent);
  });

  it('should create a new wrapper and move children into it', () => {
    const grandparent = document.createElement('div');
    const child1 = document.createElement('span');
    const child2 = document.createElement('input');
    grandparent.appendChild(child1);
    grandparent.appendChild(child2);

    const wrapper = ensureWrapped(child1);
    expect(wrapper.tagName).toBe('DIV');
    expect(wrapper.parentElement).toBe(grandparent);
    expect(wrapper.contains(child1)).toBe(true);
    expect(wrapper.contains(child2)).toBe(true);
  });

  it('should throw if element has no parent', () => {
    const orphan = document.createElement('div');
    expect(() => ensureWrapped(orphan)).toThrow('Element must be attached to the DOM');
  });
});
