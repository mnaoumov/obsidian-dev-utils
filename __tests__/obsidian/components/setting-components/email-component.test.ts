// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { EmailComponent } from '../../../../src/obsidian/components/setting-components/email-component.ts';

vi.mock('../../../../src/css-class.ts', () => ({
  CssClass: {
    EmailComponent: 'email-component'
  }
}));

vi.mock('../../../../src/obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('EmailComponent', () => {
  function createComponent(): EmailComponent {
    const container = document.createElement('div');
    return new EmailComponent(container);
  }

  it('should create with input type email', () => {
    const comp = createComponent();
    expect(comp.inputEl.type).toBe('email');
  });

  it('should convert string to email via valueFromString', () => {
    const comp = createComponent();
    expect(comp.valueFromString('test@example.com')).toBe('test@example.com');
  });

  it('should set and get value', () => {
    const comp = createComponent();
    comp.setValue('user@example.com');
    expect(comp.getValue()).toBe('user@example.com');
  });

  it('should check isEmpty and empty', () => {
    const comp = createComponent();
    expect(comp.isEmpty()).toBe(true);
    comp.setValue('x@y.z');
    expect(comp.isEmpty()).toBe(false);
    comp.empty();
    expect(comp.isEmpty()).toBe(true);
  });

  it('should set placeholder value', () => {
    const comp = createComponent();
    comp.setPlaceholderValue('user@example.com');
  });
});
