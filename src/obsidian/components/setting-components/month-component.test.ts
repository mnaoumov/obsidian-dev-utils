// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { MonthComponent } from './month-component.ts';

vi.mock('../../../css-class.ts', () => ({
  CssClass: {
    MonthComponent: 'month-component'
  }
}));

vi.mock('../../../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('MonthComponent', () => {
  function createComponent(): MonthComponent {
    const container = document.createElement('div');
    return new MonthComponent(container);
  }

  it('should create with input type month', () => {
    const comp = createComponent();
    expect(comp.inputEl.type).toBe('month');
  });

  it('should convert string to IsoMonth', () => {
    const comp = createComponent();
    const result = comp.valueFromString('2024-06');
    expect(result.year).toBe(2024);
    expect(result.month).toBe(6);
  });

  it('should throw for invalid month string', () => {
    const comp = createComponent();
    expect(() => comp.valueFromString('invalid')).toThrow('Invalid month');
  });

  it('should convert IsoMonth to string', () => {
    const comp = createComponent();
    expect(comp.valueToString({ month: 6, year: 2024 })).toBe('2024-06');
  });

  it('should round-trip month value', () => {
    const comp = createComponent();
    const value = { month: 12, year: 2024 };
    comp.setValue(value);
    const result = comp.getValue();
    expect(result.month).toBe(12);
    expect(result.year).toBe(2024);
  });
});
