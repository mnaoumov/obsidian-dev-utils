// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { TypedDropdownComponent } from '../../../../src/obsidian/Components/SettingComponents/TypedDropdownComponent.ts';

vi.mock('../../../../src/CssClass.ts', () => ({
  CssClass: {
    TypedDropdownComponent: 'typed-dropdown-component'
  }
}));

vi.mock('../../../../src/obsidian/Plugin/PluginContext.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('TypedDropdownComponent', () => {
  function createComponent(): TypedDropdownComponent<string> {
    const container = document.createElement('div');
    return new TypedDropdownComponent<string>(container);
  }

  it('should create with a select element', () => {
    const comp = createComponent();
    expect(comp.selectEl).toBeInstanceOf(HTMLSelectElement);
  });

  it('should return selectEl as validatorEl', () => {
    const comp = createComponent();
    expect(comp.validatorEl).toBe(comp.selectEl);
  });

  it('should add options and get value', () => {
    const comp = createComponent();
    comp.addOption('apple', 'Apple');
    comp.addOption('banana', 'Banana');
    comp.selectEl.selectedIndex = 1;
    expect(comp.getValue()).toBe('banana');
  });

  it('should return null when no option selected', () => {
    const comp = createComponent();
    comp.selectEl.selectedIndex = -1;
    expect(comp.getValue()).toBeNull();
  });

  it('should set value', () => {
    const comp = createComponent();
    comp.addOption('a', 'A');
    comp.addOption('b', 'B');
    comp.setValue('b');
    expect(comp.selectEl.selectedIndex).toBe(1);
  });

  it('should set null value', () => {
    const comp = createComponent();
    comp.addOption('a', 'A');
    comp.setValue(null);
    expect(comp.selectEl.selectedIndex).toBe(-1);
  });

  it('should add duplicate option without creating new entry', () => {
    const comp = createComponent();
    comp.addOption('a', 'A');
    comp.addOption('a', 'A2');
    comp.selectEl.selectedIndex = 0;
    expect(comp.getValue()).toBe('a');
  });

  it('should add multiple options from Map', () => {
    const comp = createComponent();
    const options = new Map([['x', 'X'], ['y', 'Y']]);
    comp.addOptions(options);
    comp.selectEl.selectedIndex = 1;
    expect(comp.getValue()).toBe('y');
  });

  it('should call onChange callback when dropdown changes', () => {
    const comp = createComponent();
    comp.addOption('a', 'A');
    const callback = vi.fn();
    comp.onChange(callback);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any -- Accessing private mock for test
    (comp as any).dropdownComponent.simulateChange();
    expect(callback).toHaveBeenCalledWith('a');
  });

  it('should set disabled state', () => {
    const comp = createComponent();
    comp.setDisabled(true);
    expect(comp.disabled).toBe(true);
  });
});
