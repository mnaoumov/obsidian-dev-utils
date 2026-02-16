// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { MultipleDropdownComponent } from '../../../../src/obsidian/Components/SettingComponents/MultipleDropdownComponent.ts';
import { assertNonNullable } from '../../../../src/TypeGuards.ts';

vi.mock('../../../../src/CssClass.ts', () => ({
  CssClass: {
    MultipleDropdownComponent: 'multiple-dropdown-component'
  }
}));

vi.mock('../../../../src/obsidian/Plugin/PluginContext.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('MultipleDropdownComponent', () => {
  function createComponent(): MultipleDropdownComponent {
    const container = document.createElement('div');
    return new MultipleDropdownComponent(container);
  }

  it('should create with a multiple select element', () => {
    const comp = createComponent();
    expect(comp.selectEl).toBeInstanceOf(HTMLSelectElement);
    expect(comp.selectEl.multiple).toBe(true);
  });

  it('should return selectEl as validatorEl', () => {
    const comp = createComponent();
    expect(comp.validatorEl).toBe(comp.selectEl);
  });

  it('should add options', () => {
    const comp = createComponent();
    comp.addOption('a', 'A');
    comp.addOption('b', 'B');
    expect(comp.selectEl.options.length).toBe(2);
  });

  it('should add multiple options via addOptions', () => {
    const comp = createComponent();
    comp.addOptions({ x: 'X', y: 'Y' });
    expect(comp.selectEl.options.length).toBe(2);
  });

  it('should get selected values', () => {
    const comp = createComponent();
    comp.addOption('a', 'A');
    comp.addOption('b', 'B');
    comp.addOption('c', 'C');
    const opt0 = comp.selectEl.options[0];
    assertNonNullable(opt0);
    opt0.selected = true;
    const opt2 = comp.selectEl.options[2];
    assertNonNullable(opt2);
    opt2.selected = true;
    expect(comp.getValue()).toEqual(['a', 'c']);
  });

  it('should set values', () => {
    const comp = createComponent();
    comp.addOption('a', 'A');
    comp.addOption('b', 'B');
    comp.addOption('c', 'C');
    comp.setValue(['a', 'c']);
    const opt0 = comp.selectEl.options[0];
    assertNonNullable(opt0);
    expect(opt0.selected).toBe(true);
    const opt1 = comp.selectEl.options[1];
    assertNonNullable(opt1);
    expect(opt1.selected).toBe(false);
    const opt2 = comp.selectEl.options[2];
    assertNonNullable(opt2);
    expect(opt2.selected).toBe(true);
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
