// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { UrlComponent } from '../../../../src/obsidian/Components/SettingComponents/UrlComponent.ts';

vi.mock('../../../../src/CssClass.ts', () => ({
  CssClass: {
    UrlComponent: 'url-component'
  }
}));

vi.mock('../../../../src/obsidian/Plugin/PluginContext.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('UrlComponent', () => {
  function createComponent(): UrlComponent {
    const container = document.createElement('div');
    return new UrlComponent(container);
  }

  it('should create with input type url', () => {
    const comp = createComponent();
    expect(comp.inputEl.type).toBe('url');
  });

  it('should convert string via valueFromString', () => {
    const comp = createComponent();
    expect(comp.valueFromString('https://example.com')).toBe('https://example.com');
  });

  it('should check isEmpty and empty', () => {
    const comp = createComponent();
    expect(comp.isEmpty()).toBe(true);
    comp.setValue('https://example.com');
    expect(comp.isEmpty()).toBe(false);
    comp.empty();
    expect(comp.isEmpty()).toBe(true);
  });

  it('should set placeholder value', () => {
    const comp = createComponent();
    comp.setPlaceholderValue('https://example.com');
  });
});
