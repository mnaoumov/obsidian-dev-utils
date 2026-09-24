// @vitest-environment jsdom

import { join } from 'node:path';
import { compile } from 'sass';
import {
  describe,
  expect,
  it
} from 'vitest';

import { addPluginCssClasses } from '../obsidian/plugin/plugin-context.ts';
import { MultipleDropdownComponent } from '../obsidian/setting-components/multiple-dropdown-component.ts';

function getCompiledSelectors(): string[] {
  const { css } = compile(join(import.meta.dirname, 'main.scss'));
  const styleEl = createEl('style');
  styleEl.textContent = css;
  document.head.append(styleEl);
  const selectors: string[] = [];
  for (const rule of styleEl.sheet?.cssRules ?? []) {
    if (rule instanceof CSSStyleRule) {
      selectors.push(...rule.selectorText.split(',').map((selector) => selector.trim()));
    }
  }
  styleEl.remove();
  return selectors;
}

describe('compiled styles', () => {
  const selectors = getCompiledSelectors();

  it('should never glue a selector onto the library class', () => {
    expect(selectors.filter((selector) => /\.obsidian-dev-utils[\w-]/.test(selector.replaceAll(/\.obsidian-dev-utils-lock-indicator[\w-]*/g, ''))))
      .toEqual([]);
  });

  it('should reach the select of a multiple dropdown', () => {
    const containerEl = createDiv();
    const component = new MultipleDropdownComponent(containerEl);
    const selectSelectors = selectors.filter((selector) => selector.includes('multiple-dropdown-component') && selector.endsWith(' select'));
    expect(selectSelectors).not.toEqual([]);
    for (const selector of selectSelectors) {
      expect(component.selectEl.matches(selector)).toBe(true);
    }
  });

  it('should reach the loop progress bar', () => {
    const progressBarEl = createEl('progress');
    addPluginCssClasses(progressBarEl, 'loop');
    const loopSelectors = selectors.filter((selector) => selector.includes('.loop'));
    expect(loopSelectors).not.toEqual([]);
    for (const selector of loopSelectors) {
      expect(progressBarEl.matches(selector)).toBe(true);
    }
  });
});
