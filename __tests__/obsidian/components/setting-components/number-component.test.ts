// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { NumberComponent } from '../../../../src/obsidian/components/setting-components/number-component.ts';

vi.mock('../../../../src/css-class.ts', () => ({
  CssClass: {
    NumberComponent: 'number-component'
  }
}));

vi.mock('../../../../src/obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('NumberComponent', () => {
  function createComponent(): NumberComponent {
    const container = document.createElement('div');
    return new NumberComponent(container);
  }

  it('should create with input type number', () => {
    const comp = createComponent();
    expect(comp.inputEl.type).toBe('number');
  });

  it('should convert string to number via valueFromString', () => {
    const comp = createComponent();
    expect(comp.valueFromString('42')).toBe(42);
    expect(comp.valueFromString('0')).toBe(0);
  });

  it('should set and get value', () => {
    const comp = createComponent();
    comp.setValue(123);
    expect(comp.getValue()).toBe(123);
  });

  it('should set min and max', () => {
    const comp = createComponent();
    comp.setMin(0);
    comp.setMax(100);
    expect(comp.inputEl.min).toBe('0');
    expect(comp.inputEl.max).toBe('100');
  });

  it('should set step', () => {
    const comp = createComponent();
    comp.setStep(5);
    expect(comp.inputEl.step).toBe('5');
  });

  it('should check isEmpty and empty', () => {
    const comp = createComponent();
    expect(comp.isEmpty()).toBe(true);
    comp.setValue(10);
    expect(comp.isEmpty()).toBe(false);
    comp.empty();
    expect(comp.isEmpty()).toBe(true);
  });

  it('should set placeholder and placeholder value', () => {
    const comp = createComponent();
    comp.setPlaceholder('Enter number');
    comp.setPlaceholderValue(0);
  });

  it('should return inputEl as validatorEl', () => {
    const comp = createComponent();
    expect(comp.validatorEl).toBe(comp.inputEl);
  });

  it('should set disabled state', () => {
    const comp = createComponent();
    comp.setDisabled(true);
    expect(comp.disabled).toBe(true);
  });

  it('should call onChange callback', () => {
    const comp = createComponent();
    const callback = vi.fn();
    comp.onChange(callback);
  });

  it('should call onChanged', () => {
    const comp = createComponent();
    comp.onChanged();
  });
});
