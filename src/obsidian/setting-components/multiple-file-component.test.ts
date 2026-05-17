// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { MultipleFileComponent } from './multiple-file-component.ts';

vi.mock('../../../css-class.ts', () => ({
  CssClass: {
    MultipleFileComponent: 'multiple-file-component'
  }
}));

vi.mock('../../../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('MultipleFileComponent', () => {
  function createComponent(): MultipleFileComponent {
    const container = createDiv();
    return new MultipleFileComponent(container);
  }

  it('should create with input type file and multiple attribute', () => {
    const comp = createComponent();
    expect(comp.inputEl.type).toBe('file');
    expect(comp.inputEl.multiple).toBe(true);
  });

  it('should return empty array when no files selected', () => {
    const comp = createComponent();
    expect(comp.getValue()).toEqual([]);
  });

  it('should return getValue from valueFromString', () => {
    const comp = createComponent();
    expect(comp.valueFromString()).toEqual([]);
  });

  it('should convert empty files to empty string', () => {
    const comp = createComponent();
    expect(comp.valueToString([])).toBe('');
  });

  it('should convert files to first file name', () => {
    const comp = createComponent();
    const file = new File(['content'], 'test.txt');
    expect(comp.valueToString([file])).toBe('test.txt');
  });
});
