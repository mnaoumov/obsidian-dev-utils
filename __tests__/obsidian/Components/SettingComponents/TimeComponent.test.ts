// @vitest-environment jsdom

import { moment } from 'obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { TimeComponent } from '../../../../src/obsidian/Components/SettingComponents/TimeComponent.ts';

vi.mock('../../../../src/CssClass.ts', () => ({
  CssClass: {
    TimeComponent: 'time-component'
  }
}));

vi.mock('../../../../src/obsidian/Plugin/PluginContext.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('TimeComponent', () => {
  function createComponent(): TimeComponent {
    const container = document.createElement('div');
    return new TimeComponent(container);
  }

  it('should create with input type time', () => {
    const comp = createComponent();
    expect(comp.inputEl.type).toBe('time');
  });

  it('should convert string to Duration', () => {
    const comp = createComponent();
    const result = comp.valueFromString('14:30');
    expect(result.hours()).toBe(14);
    expect(result.minutes()).toBe(30);
  });

  it('should convert Duration to HH:mm string', () => {
    const comp = createComponent();
    const duration = moment.duration({ hours: 14, minutes: 30 });
    expect(comp.valueToString(duration)).toBe('14:30');
  });

  it('should convert Duration with seconds to HH:mm:ss string', () => {
    const comp = createComponent();
    const duration = moment.duration({ hours: 14, minutes: 30, seconds: 45 });
    expect(comp.valueToString(duration)).toBe('14:30:45');
  });

  it('should convert Duration with milliseconds to HH:mm:ss.SSS string', () => {
    const comp = createComponent();
    const duration = moment.duration({ hours: 14, milliseconds: 500, minutes: 30, seconds: 45 });
    expect(comp.valueToString(duration)).toBe('14:30:45.500');
  });
});
