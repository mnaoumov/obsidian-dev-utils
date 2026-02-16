// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PasswordComponent } from '../../../../src/obsidian/Components/SettingComponents/PasswordComponent.ts';

vi.mock('../../../../src/CssClass.ts', () => ({
  CssClass: {
    PasswordComponent: 'password-component'
  }
}));

vi.mock('../../../../src/obsidian/Plugin/PluginContext.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('PasswordComponent', () => {
  function createComponent(): PasswordComponent {
    const container = document.createElement('div');
    return new PasswordComponent(container);
  }

  it('should create with input type password', () => {
    const comp = createComponent();
    expect(comp.inputEl.type).toBe('password');
  });

  it('should convert string via valueFromString', () => {
    const comp = createComponent();
    expect(comp.valueFromString('secret')).toBe('secret');
  });

  it('should set and get value', () => {
    const comp = createComponent();
    comp.setValue('p@ssw0rd');
    expect(comp.getValue()).toBe('p@ssw0rd');
  });

  it('should set placeholder', () => {
    const comp = createComponent();
    comp.setPlaceholder('Enter password');
  });
});
