/**
 * @file
 *
 * Tests for {@link CommandHandler}.
 */

import type { Command } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { CommandHandlerParams } from './command-handler.ts';

import { CommandHandler } from './command-handler.ts';

class TestCommandHandler extends CommandHandler {
  public override buildCommand(): Command {
    return {
      icon: this.icon,
      id: this.id,
      name: this.name
    };
  }
}

function createParams(overrides?: Partial<CommandHandlerParams>): CommandHandlerParams {
  return {
    icon: 'test-icon',
    id: 'test-id',
    name: 'Test Command',
    pluginName: 'Test Plugin',
    ...overrides
  };
}

describe('CommandHandler', () => {
  it('should store constructor params as public fields', () => {
    const handler = new TestCommandHandler(createParams());

    expect(handler.icon).toBe('test-icon');
    expect(handler.id).toBe('test-id');
    expect(handler.name).toBe('Test Command');
  });

  it('should expose pluginName as protected field via subclass', () => {
    class ExposingHandler extends TestCommandHandler {
      public getPluginName(): string {
        return this.pluginName;
      }
    }

    const handler = new ExposingHandler(createParams({ pluginName: 'My Plugin' }));
    expect(handler.getPluginName()).toBe('My Plugin');
  });

  it('should build a command from handler properties', () => {
    const handler = new TestCommandHandler(createParams({
      icon: 'wand',
      id: 'my-cmd',
      name: 'My Command'
    }));

    const command = handler.buildCommand();
    expect(command.id).toBe('my-cmd');
    expect(command.name).toBe('My Command');
    expect(command.icon).toBe('wand');
  });

  it('should have a no-op default onRegistered', async () => {
    const handler = new TestCommandHandler(createParams());
    await expect(handler.onRegistered({
      activeFileProvider: { getActiveFile: () => null },
      menuEventRegistrar: {
        registerEditorMenuEventHandler: vi.fn(),
        registerFileMenuEventHandler: vi.fn(),
        registerFilesMenuEventHandler: vi.fn()
      }
    })).resolves.toBeUndefined();
  });
});
