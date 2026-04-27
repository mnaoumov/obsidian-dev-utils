import type { Plugin } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ActiveFileProvider } from '../../active-file-provider.ts';
import type { CommandRegistrar } from '../../command-registrar.ts';
import type { MenuEventRegistrar } from '../../menu-event-registrar.ts';
import type { PluginSettingsTabBase } from '../plugin-settings-tab.ts';

import { strictProxy } from '../../../test-helpers/mock-implementation.ts';
import { assertNonNullable } from '../../../type-guards.ts';
import { CommandHandlerComponent } from '../../command-handlers/command-handler-component.ts';
import { PluginSettingsTabComponent } from './plugin-settings-tab-component.ts';

vi.mock('../../command-handlers/command-handler-component.ts', async () => {
  const obsidian = await vi.importActual<typeof import('obsidian')>('obsidian');
  class MockCommandHandlerComponent extends obsidian.Component {
    public constructor(public readonly params: unknown) {
      super();
    }
  }
  return { CommandHandlerComponent: MockCommandHandlerComponent };
});

describe('PluginSettingsTabComponent', () => {
  function createMockPlugin(): Plugin {
    return strictProxy<Plugin>({
      addCommand: vi.fn(),
      addSettingTab: vi.fn(),
      manifest: { id: 'test-plugin', name: 'Test Plugin' }
    });
  }

  function createMockSettingsTab(): PluginSettingsTabBase<object> {
    return strictProxy<PluginSettingsTabBase<object>>({
      show: vi.fn()
    });
  }

  function createMockActiveFileProvider(): ActiveFileProvider {
    return strictProxy<ActiveFileProvider>({});
  }

  function createMockMenuEventRegistrar(): MenuEventRegistrar {
    return strictProxy<MenuEventRegistrar>({});
  }

  function createMockCommandRegistrar(): CommandRegistrar {
    return strictProxy<CommandRegistrar>({
      addCommand: vi.fn()
    });
  }

  it('should register settings tab on load', () => {
    const plugin = createMockPlugin();
    const pluginSettingsTab = createMockSettingsTab();
    const component = new PluginSettingsTabComponent({
      activeFileProvider: createMockActiveFileProvider(),
      commandRegistrar: createMockCommandRegistrar(),
      menuEventRegistrar: createMockMenuEventRegistrar(),
      plugin,
      pluginSettingsTab
    });

    component.load();

    expect(plugin.addSettingTab).toHaveBeenCalledWith(pluginSettingsTab);
  });

  it('should add CommandHandlerComponent with OpenSettingsCommandHandler as child', () => {
    const plugin = createMockPlugin();
    const pluginSettingsTab = createMockSettingsTab();
    const component = new PluginSettingsTabComponent({
      activeFileProvider: createMockActiveFileProvider(),
      commandRegistrar: createMockCommandRegistrar(),
      menuEventRegistrar: createMockMenuEventRegistrar(),
      plugin,
      pluginSettingsTab
    });

    component.load();

    const children = component._children;
    const commandHandlerChild = children.find((child) => child instanceof CommandHandlerComponent);
    assertNonNullable(commandHandlerChild);
    expect(commandHandlerChild).toBeInstanceOf(CommandHandlerComponent);
  });
});
