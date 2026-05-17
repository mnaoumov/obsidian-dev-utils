import type {
  Plugin,
  PluginSettingTab
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../../test-helpers/mock-implementation.ts';
import { PluginSettingsTabComponent } from './plugin-settings-tab-component.ts';

describe('PluginSettingsTabComponent', () => {
  function createMockPlugin(): Plugin {
    return strictProxy<Plugin>({
      addSettingTab: vi.fn()
    });
  }

  function createMockSettingsTab(): PluginSettingTab {
    return strictProxy<PluginSettingTab>({});
  }

  it('should register settings tab on load', () => {
    const plugin = createMockPlugin();
    const pluginSettingsTab = createMockSettingsTab();
    const component = new PluginSettingsTabComponent({
      plugin,
      pluginSettingsTab
    });

    component.load();

    expect(plugin.addSettingTab).toHaveBeenCalledWith(pluginSettingsTab);
  });
});
