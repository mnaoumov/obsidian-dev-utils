import type {
  Command,
  Plugin
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../../../test-helpers/mock-implementation.ts';
import { PluginSettingsTabComponent } from './plugin-settings-tab-component.ts';

describe('PluginSettingsTabComponent', () => {
  function createMockPlugin(): Plugin {
    return strictProxy<Plugin>({
      addCommand: vi.fn(),
      addSettingTab: vi.fn(),
      app: {
        setting: {
          open: vi.fn(),
          openTabById: vi.fn()
        }
      },
      manifest: { id: 'test-plugin' }
    });
  }

  it('should register settings tab and open-settings command on load', () => {
    const plugin = createMockPlugin();
    const settingsTab = {} as never;
    const component = new PluginSettingsTabComponent(plugin, settingsTab);

    component.onload();

    expect(plugin.addSettingTab).toHaveBeenCalledWith(settingsTab);
    expect(plugin.addCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: 'settings',
        id: 'open-settings',
        name: 'Open settings'
      })
    );
  });

  it('should open settings when open-settings command is executed', () => {
    const plugin = createMockPlugin();
    const settingsTab = {} as never;
    const component = new PluginSettingsTabComponent(plugin, settingsTab);

    component.onload();

    const addCommandCalls: Command[][] = vi.mocked(plugin.addCommand).mock.calls as never;
    const command = addCommandCalls[0]?.[0];
    command?.callback?.();

    expect(plugin.app.setting.openTabById).toHaveBeenCalledWith('test-plugin');
    expect(plugin.app.setting.open).toHaveBeenCalled();
  });
});
