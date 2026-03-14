// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { WeekComponent } from './week-component.ts';

vi.mock('../../../css-class.ts', () => ({
  CssClass: {
    WeekComponent: 'week-component'
  }
}));

vi.mock('../../../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('WeekComponent', () => {
  function createComponent(): WeekComponent {
    const container = document.createElement('div');
    return new WeekComponent(container);
  }

  it('should create with input type week', () => {
    const comp = createComponent();
    expect(comp.inputEl.type).toBe('week');
  });

  it('should convert string to IsoWeek', () => {
    const comp = createComponent();
    const result = comp.valueFromString('2024-W01');
    expect(result.year).toBe(2024);
    expect(result.weekNumber).toBe(1);
  });

  it('should throw for invalid week string', () => {
    const comp = createComponent();
    expect(() => comp.valueFromString('invalid')).toThrow('Invalid week');
  });

  it('should convert IsoWeek to string', () => {
    const comp = createComponent();
    const result = comp.valueToString({ weekNumber: 1, year: 2024 });
    expect(result).toBe('2024-W01');
  });

  it('should round-trip week value', () => {
    const comp = createComponent();
    const value = { weekNumber: 52, year: 2024 };
    comp.setValue(value);
    const result = comp.getValue();
    expect(result.weekNumber).toBe(52);
    expect(result.year).toBe(2024);
  });
});
