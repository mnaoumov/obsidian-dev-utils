// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { TelephoneComponent } from '../../../../src/obsidian/Components/SettingComponents/TelephoneComponent.ts';

vi.mock('../../../../src/CssClass.ts', () => ({
  CssClass: {
    TelephoneComponent: 'telephone-component'
  }
}));

vi.mock('../../../../src/obsidian/Plugin/PluginContext.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('TelephoneComponent', () => {
  function createComponent(): TelephoneComponent {
    const container = document.createElement('div');
    return new TelephoneComponent(container);
  }

  it('should create with input type tel', () => {
    const comp = createComponent();
    expect(comp.inputEl.type).toBe('tel');
  });

  it('should convert string via valueFromString', () => {
    const comp = createComponent();
    expect(comp.valueFromString('+1234567890')).toBe('+1234567890');
  });

  it('should check isEmpty and empty', () => {
    const comp = createComponent();
    expect(comp.isEmpty()).toBe(true);
    comp.setValue('555-1234');
    expect(comp.isEmpty()).toBe(false);
    comp.empty();
    expect(comp.isEmpty()).toBe(true);
  });

  it('should set placeholder value', () => {
    const comp = createComponent();
    comp.setPlaceholderValue('+1-555-1234');
  });
});
