// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { assertNonNullable } from '../../../type-guards.ts';
import { TypedMultipleDropdownComponent } from './typed-multiple-dropdown-component.ts';

vi.mock('../../../css-class.ts', () => ({
  CssClass: {
    MultipleDropdownComponent: 'multiple-dropdown-component',
    TypedMultipleDropdownComponent: 'typed-multiple-dropdown-component'
  }
}));

vi.mock('../../../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('TypedMultipleDropdownComponent', () => {
  function createComponent(): TypedMultipleDropdownComponent<string> {
    const container = document.createElement('div');
    return new TypedMultipleDropdownComponent<string>(container);
  }

  it('should create with a select element', () => {
    const comp = createComponent();
    expect(comp.selectEl).toBeInstanceOf(HTMLSelectElement);
  });

  it('should return selectEl as validatorEl', () => {
    const comp = createComponent();
    expect(comp.validatorEl).toBe(comp.selectEl);
  });

  it('should add options and get values', () => {
    const comp = createComponent();
    comp.addOption('apple', 'Apple');
    comp.addOption('banana', 'Banana');
    comp.addOption('cherry', 'Cherry');
    const opt0 = comp.selectEl.options[0];
    assertNonNullable(opt0);
    opt0.selected = true;
    const opt2 = comp.selectEl.options[2];
    assertNonNullable(opt2);
    opt2.selected = true;
    expect(comp.getValue()).toEqual(['apple', 'cherry']);
  });

  it('should add duplicate option without creating new entry', () => {
    const comp = createComponent();
    comp.addOption('a', 'A');
    comp.addOption('a', 'A2');
    expect(comp.selectEl.options.length).toBe(2);
    const opt0 = comp.selectEl.options[0];
    assertNonNullable(opt0);
    opt0.selected = true;
    expect(comp.getValue()).toEqual(['a']);
  });

  it('should add multiple options from Map', () => {
    const comp = createComponent();
    const options = new Map([['x', 'X'], ['y', 'Y']]);
    comp.addOptions(options);
    const opt0 = comp.selectEl.options[0];
    assertNonNullable(opt0);
    opt0.selected = true;
    const opt1 = comp.selectEl.options[1];
    assertNonNullable(opt1);
    opt1.selected = true;
    expect(comp.getValue()).toEqual(['x', 'y']);
  });

  it('should set values', () => {
    const comp = createComponent();
    comp.addOption('a', 'A');
    comp.addOption('b', 'B');
    comp.addOption('c', 'C');
    comp.setValue(['a', 'c']);
    const selected = comp.getValue();
    expect(selected).toEqual(['a', 'c']);
  });

  it('should filter out unknown values when setting', () => {
    const comp = createComponent();
    comp.addOption('a', 'A');
    comp.setValue(['a', 'unknown']);
    expect(comp.getValue()).toEqual(['a']);
  });

  it('should register onChange callback and forward current value', () => {
    const comp = createComponent();
    comp.addOption('a', 'A');
    comp.addOption('b', 'B');
    const opt0 = comp.selectEl.options[0];
    assertNonNullable(opt0);
    opt0.selected = true;
    const callback = vi.fn();
    comp.onChange(callback);
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- simulateChange is intended for test use.
    comp.simulateChange();
    expect(callback).toHaveBeenCalledWith(['a']);
  });

  it('should set disabled state', () => {
    const comp = createComponent();
    comp.setDisabled(true);
    expect(comp.disabled).toBe(true);
  });
});
