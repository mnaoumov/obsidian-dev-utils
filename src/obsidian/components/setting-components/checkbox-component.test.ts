// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { CheckboxComponent } from './checkbox-component.ts';

vi.mock('../../../css-class.ts', () => ({
  CssClass: {
    CheckboxComponent: 'checkbox-component'
  }
}));

vi.mock('../../../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('CheckboxComponent', () => {
  function createComponent(): CheckboxComponent {
    const container = document.createElement('div');
    return new CheckboxComponent(container);
  }

  it('should create an input element of type checkbox', () => {
    const comp = createComponent();
    expect(comp.inputEl).toBeInstanceOf(HTMLInputElement);
    expect(comp.inputEl.type).toBe('checkbox');
  });

  it('should return false by default', () => {
    const comp = createComponent();
    expect(comp.getValue()).toBe(false);
  });

  it('should set and get value', () => {
    const comp = createComponent();
    comp.setValue(true);
    expect(comp.getValue()).toBe(true);
    comp.setValue(false);
    expect(comp.getValue()).toBe(false);
  });

  it('should return inputEl as validatorEl', () => {
    const comp = createComponent();
    expect(comp.validatorEl).toBe(comp.inputEl);
  });

  it('should call change callback on change event', () => {
    const comp = createComponent();
    const callback = vi.fn();
    comp.onChange(callback);
    comp.inputEl.checked = true;
    comp.onChanged();
    expect(callback).toHaveBeenCalledWith(true);
  });

  it('should not throw if no change callback is set', () => {
    const comp = createComponent();
    expect(() => {
      comp.onChanged();
    }).not.toThrow();
  });

  it('should set disabled state', () => {
    const comp = createComponent();
    comp.setDisabled(true);
    expect(comp.inputEl.disabled).toBe(true);
    comp.setDisabled(false);
    expect(comp.inputEl.disabled).toBe(false);
  });
});
