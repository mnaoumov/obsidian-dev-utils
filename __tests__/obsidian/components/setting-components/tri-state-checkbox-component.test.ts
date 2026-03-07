// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { TriStateCheckboxComponent } from '../../../../src/obsidian/components/setting-components/tri-state-checkbox-component.ts';

vi.mock('../../../../src/css-class.ts', () => ({
  CssClass: {
    TriStateCheckboxComponent: 'tri-state-checkbox-component'
  }
}));

vi.mock('../../../../src/obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('TriStateCheckboxComponent', () => {
  function createComponent(): TriStateCheckboxComponent {
    const container = document.createElement('div');
    return new TriStateCheckboxComponent(container);
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

  it('should set true value', () => {
    const comp = createComponent();
    comp.setValue(true);
    expect(comp.getValue()).toBe(true);
    expect(comp.inputEl.checked).toBe(true);
    expect(comp.inputEl.indeterminate).toBe(false);
  });

  it('should set null (indeterminate) value', () => {
    const comp = createComponent();
    comp.setValue(null);
    expect(comp.getValue()).toBeNull();
    expect(comp.inputEl.indeterminate).toBe(true);
    expect(comp.inputEl.checked).toBe(false);
  });

  it('should set false value', () => {
    const comp = createComponent();
    comp.setValue(true);
    comp.setValue(false);
    expect(comp.getValue()).toBe(false);
    expect(comp.inputEl.checked).toBe(false);
    expect(comp.inputEl.indeterminate).toBe(false);
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
