// @vitest-environment jsdom

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { SettingEx } from './setting-ex.ts';
import { SettingGroupEx } from './setting-group-ex.ts';

vi.mock('../obsidian/setting-ex.ts', () => ({
  SettingEx: vi.fn()
}));

describe('SettingGroupEx', () => {
  let settingGroupEx: SettingGroupEx;

  beforeEach(() => {
    vi.clearAllMocks();
    settingGroupEx = new SettingGroupEx(createDiv());
  });

  it('should create an instance', () => {
    expect(settingGroupEx).toBeInstanceOf(SettingGroupEx);
  });

  it('should add a SettingEx and call the callback', () => {
    const callback = vi.fn();
    const result = settingGroupEx.addSettingEx(callback);
    expect(result).toBe(settingGroupEx);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(SettingEx).toHaveBeenCalledWith(settingGroupEx.listEl);
  });
});
