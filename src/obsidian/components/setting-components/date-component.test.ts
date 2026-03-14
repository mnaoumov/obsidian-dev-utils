// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { DateComponent } from './date-component.ts';

vi.mock('../../../css-class.ts', () => ({
  CssClass: {
    DateComponent: 'date-component'
  }
}));

vi.mock('../../../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('DateComponent', () => {
  function createComponent(): DateComponent {
    const container = document.createElement('div');
    return new DateComponent(container);
  }

  it('should create with input type date', () => {
    const comp = createComponent();
    expect(comp.inputEl.type).toBe('date');
  });

  it('should convert string to Date', () => {
    const comp = createComponent();
    const date = comp.valueFromString('2024-06-15');
    expect(date).toBeInstanceOf(Date);
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(5); // 0-indexed
    expect(date.getDate()).toBe(15);
  });

  it('should convert Date to string', () => {
    const comp = createComponent();
    const date = new Date(2024, 5, 15); // June 15, 2024
    expect(comp.valueToString(date)).toBe('2024-06-15');
  });

  it('should round-trip date value', () => {
    const comp = createComponent();
    const date = new Date(2024, 0, 1); // Jan 1, 2024
    comp.setValue(date);
    const result = comp.getValue();
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });
});
