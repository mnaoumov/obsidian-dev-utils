// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { MultipleEmailComponent } from '../../../../src/obsidian/Components/SettingComponents/MultipleEmailComponent.ts';

vi.mock('../../../../src/CssClass.ts', () => ({
  CssClass: {
    MultipleEmailComponent: 'multiple-email-component'
  }
}));

vi.mock('../../../../src/obsidian/Plugin/PluginContext.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('MultipleEmailComponent', () => {
  function createComponent(): MultipleEmailComponent {
    const container = document.createElement('div');
    return new MultipleEmailComponent(container);
  }

  it('should create with input type email and multiple attribute', () => {
    const comp = createComponent();
    expect(comp.inputEl.type).toBe('email');
    expect(comp.inputEl.multiple).toBe(true);
  });

  it('should convert comma-separated string to array', () => {
    const comp = createComponent();
    expect(comp.valueFromString('a@b.c, d@e.f')).toEqual(['a@b.c', 'd@e.f']);
  });

  it('should convert array to comma-separated string', () => {
    const comp = createComponent();
    expect(comp.valueToString(['a@b.c', 'd@e.f'])).toBe('a@b.c, d@e.f');
  });

  it('should set and get values', () => {
    const comp = createComponent();
    comp.setValue(['x@y.z', 'a@b.c']);
    expect(comp.getValue()).toEqual(['x@y.z', 'a@b.c']);
  });
});
