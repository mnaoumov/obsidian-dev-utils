// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { MultipleTextComponent } from '../../../../src/obsidian/components/setting-components/multiple-text-component.ts';

vi.mock('../../../../src/css-class.ts', () => ({
  CssClass: {
    MultipleTextComponent: 'multiple-text-component'
  }
}));

vi.mock('../../../../src/obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('MultipleTextComponent', () => {
  function createComponent(): MultipleTextComponent {
    const container = document.createElement('div');
    return new MultipleTextComponent(container);
  }

  it('should create with a textarea element', () => {
    const comp = createComponent();
    expect(comp.inputEl).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('should return inputEl as validatorEl', () => {
    const comp = createComponent();
    expect(comp.validatorEl).toBe(comp.inputEl);
  });

  it('should return empty array for empty value', () => {
    const comp = createComponent();
    comp.setValue([]);
    expect(comp.getValue()).toEqual(['']);
  });

  it('should set and get multiple values', () => {
    const comp = createComponent();
    comp.setValue(['line1', 'line2', 'line3']);
    expect(comp.getValue()).toEqual(['line1', 'line2', 'line3']);
  });

  it('should check isEmpty', () => {
    const comp = createComponent();
    expect(comp.isEmpty()).toBe(true);
    comp.setValue(['hello']);
    expect(comp.isEmpty()).toBe(false);
  });

  it('should empty the component', () => {
    const comp = createComponent();
    comp.setValue(['some', 'values']);
    comp.empty();
    expect(comp.isEmpty()).toBe(true);
  });

  it('should set placeholder', () => {
    const comp = createComponent();
    comp.setPlaceholder('Enter text...');
  });

  it('should set placeholder value', () => {
    const comp = createComponent();
    comp.setPlaceholderValue(['hint1', 'hint2']);
  });

  it('should register onChange callback and forward current value', () => {
    const comp = createComponent();
    comp.setValue(['line1', 'line2']);
    const callback = vi.fn();
    comp.onChange(callback);
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- simulateChange is intended for test use.
    comp.simulateChange();
    expect(callback).toHaveBeenCalledWith(['line1', 'line2']);
  });

  it('should set disabled state', () => {
    const comp = createComponent();
    comp.setDisabled(true);
    expect(comp.disabled).toBe(true);
  });
});
