// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { FileComponent } from './file-component.ts';

vi.mock('../../../css-class.ts', () => ({
  CssClass: {
    FileComponent: 'file-component'
  }
}));

vi.mock('../../../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('FileComponent', () => {
  function createComponent(): FileComponent {
    const container = document.createElement('div');
    return new FileComponent(container);
  }

  it('should create with input type file', () => {
    const comp = createComponent();
    expect(comp.inputEl.type).toBe('file');
  });

  it('should return null when no file selected', () => {
    const comp = createComponent();
    expect(comp.getValue()).toBeNull();
  });

  it('should return null from valueFromString', () => {
    const comp = createComponent();
    expect(comp.valueFromString()).toBeNull();
  });

  it('should convert null file to empty string', () => {
    const comp = createComponent();
    expect(comp.valueToString(null)).toBe('');
  });

  it('should convert file to its name', () => {
    const comp = createComponent();
    const file = new File(['content'], 'test.txt');
    expect(comp.valueToString(file)).toBe('test.txt');
  });
});
