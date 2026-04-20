import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettingsTabBase } from '../plugin/plugin-settings-tab.ts';

import { strictProxy } from '../../test-helpers/mock-implementation.ts';
import { OpenSettingsCommandHandler } from './open-settings-command-handler.ts';

interface CreateHandlerResult {
  handler: OpenSettingsCommandHandler;
  settingsTab: PluginSettingsTabBase<object>;
}

describe('OpenSettingsCommandHandler', () => {
  function createHandler(): CreateHandlerResult {
    const settingsTab = strictProxy<PluginSettingsTabBase<object>>({
      show: vi.fn()
    });
    const handler = new OpenSettingsCommandHandler('Test Plugin', settingsTab);
    return { handler, settingsTab };
  }

  it('should have correct id, name, and icon', () => {
    const { handler } = createHandler();
    expect(handler.id).toBe('open-settings');
    expect(handler.name).toBe('Open settings');
    expect(handler.icon).toBe('settings');
  });

  it('should build a command with checkCallback', () => {
    const { handler } = createHandler();
    const command = handler.buildCommand();
    expect(command.id).toBe('open-settings');
    expect(command.name).toBe('Open settings');
    expect(command.icon).toBe('settings');
    expect(command.checkCallback).toBeTypeOf('function');
  });

  it('should call settingsTab.show() when executed', () => {
    const { handler, settingsTab } = createHandler();
    handler.execute();
    expect(settingsTab.show).toHaveBeenCalled();
  });

  it('should execute via checkCallback with checking=false', () => {
    const { handler, settingsTab } = createHandler();
    const command = handler.buildCommand();
    const result = command.checkCallback?.(false);
    expect(result).toBe(true);
    expect(settingsTab.show).toHaveBeenCalled();
  });

  it('should return true from checkCallback with checking=true without executing', () => {
    const { handler, settingsTab } = createHandler();
    const command = handler.buildCommand();
    const result = command.checkCallback?.(true);
    expect(result).toBe(true);
    expect(settingsTab.show).not.toHaveBeenCalled();
  });
});
