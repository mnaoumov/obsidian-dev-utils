import type {
  App as AppOriginal,
  SettingTab as SettingTabOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../../test-helpers/mock-implementation.ts';
import { OpenSettingsCommandHandler } from './open-settings-command-handler.ts';

interface CreateHandlerResult {
  handler: OpenSettingsCommandHandler;
  open: ReturnType<typeof vi.fn>;
  openTab: ReturnType<typeof vi.fn>;
  settingTab: SettingTabOriginal;
}

describe('OpenSettingsCommandHandler', () => {
  function createHandler(): CreateHandlerResult {
    const settingTab = strictProxy<SettingTabOriginal>({});
    const open = vi.fn();
    const openTab = vi.fn();
    const app = strictProxy<AppOriginal>({
      setting: { open, openTab }
    });
    const handler = new OpenSettingsCommandHandler({
      app,
      settingTab
    });
    return { handler, open, openTab, settingTab };
  }

  it('should build a command with checkCallback', () => {
    const { handler } = createHandler();
    const command = handler.buildCommand();
    expect(command.id).toBe('open-settings');
    expect(command.name).toBe('Open settings');
    expect(command.icon).toBe('settings');
    expect(command.checkCallback).toBeTypeOf('function');
  });

  it('should call app.setting.open() and openTab() when executed', () => {
    const { handler, open, openTab, settingTab } = createHandler();
    handler.execute();
    expect(open).toHaveBeenCalled();
    expect(openTab).toHaveBeenCalledWith(settingTab);
  });

  it('should execute via checkCallback with checking=false', () => {
    const { handler, open } = createHandler();
    const command = handler.buildCommand();
    const result = command.checkCallback?.(false);
    expect(result).toBe(true);
    expect(open).toHaveBeenCalled();
  });

  it('should return true from checkCallback with checking=true without executing', () => {
    const { handler, open } = createHandler();
    const command = handler.buildCommand();
    const result = command.checkCallback?.(true);
    expect(result).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });
});
