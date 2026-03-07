// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { DateTimeComponent } from '../../../../src/obsidian/components/setting-components/date-time-component.ts';

vi.mock('../../../../src/css-class.ts', () => ({
  CssClass: {
    DateTimeComponent: 'datetime-component'
  }
}));

vi.mock('../../../../src/obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('DateTimeComponent', () => {
  function createComponent(): DateTimeComponent {
    const container = document.createElement('div');
    return new DateTimeComponent(container);
  }

  it('should create with input type datetime-local', () => {
    const comp = createComponent();
    expect(comp.inputEl.type).toBe('datetime-local');
  });

  it('should convert string to Date', () => {
    const comp = createComponent();
    const date = comp.valueFromString('2024-06-15T14:30');
    expect(date).toBeInstanceOf(Date);
    expect(date.getFullYear()).toBe(2024);
    expect(date.getHours()).toBe(14);
    expect(date.getMinutes()).toBe(30);
  });

  it('should convert Date to string', () => {
    const comp = createComponent();
    const date = new Date(2024, 5, 15, 14, 30); // June 15, 2024 14:30
    expect(comp.valueToString(date)).toBe('2024-06-15T14:30');
  });
});
