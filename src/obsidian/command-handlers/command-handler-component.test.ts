/**
 * @file
 *
 * Tests for {@link CommandHandlerComponent}.
 */

import type {
  Command,
  Plugin as PluginOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type {
  CommandHandlerParams,
  CommandHandlerRegistrationContext
} from './command-handler.ts';

import { castTo } from '../../object-utils.ts';
import { CommandHandlerComponent } from './command-handler-component.ts';
import { CommandHandler } from './command-handler.ts';

class TestHandler extends CommandHandler {
  public registeredContext?: CommandHandlerRegistrationContext;

  public override buildCommand(): Command {
    return {
      icon: this.icon,
      id: this.id,
      name: this.name
    };
  }

  public override async onRegistered(context: CommandHandlerRegistrationContext): Promise<void> {
    await super.onRegistered(context);
    this.registeredContext = context;
  }
}

function createMockPlugin(): PluginOriginal {
  return castTo<PluginOriginal>({
    addCommand: vi.fn(),
    app: {
      workspace: {
        getActiveFile: vi.fn(() => null),
        on: vi.fn()
      }
    }
  });
}

function createParams(overrides?: Partial<CommandHandlerParams>): CommandHandlerParams {
  return {
    icon: 'test-icon',
    id: 'test-cmd',
    name: 'Test Command',
    pluginName: 'Test Plugin',
    ...overrides
  };
}

describe('CommandHandlerComponent', () => {
  it('should call plugin.addCommand with built command on load', async () => {
    const plugin = createMockPlugin();
    const handler = new TestHandler(createParams());
    const component = new CommandHandlerComponent(plugin, handler);

    await component.onload();

    expect(plugin.addCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-cmd',
        name: 'Test Command'
      })
    );
  });

  it('should provide registration context with activeFileProvider and menuEventRegistrar', async () => {
    const plugin = createMockPlugin();
    const handler = new TestHandler(createParams());
    const component = new CommandHandlerComponent(plugin, handler);

    await component.onload();

    expect(handler.registeredContext).toBeDefined();
    expect(handler.registeredContext?.activeFileProvider).toBeDefined();
    expect(handler.registeredContext?.menuEventRegistrar).toBeDefined();
  });

  it('should not mutate handler id/name after addCommand', async () => {
    const addCommand = vi.fn((cmd: Command) => {
      // Simulate Obsidian mutating the command
      cmd.id = 'modified-id';
      cmd.name = 'Modified Name';
    });
    const plugin = castTo<PluginOriginal>({
      addCommand,
      app: {
        workspace: {
          getActiveFile: vi.fn(() => null),
          on: vi.fn()
        }
      }
    });

    const handler = new TestHandler(createParams({ id: 'original-id', name: 'Original Name' }));
    const component = new CommandHandlerComponent(plugin, handler);

    await component.onload();

    // Handler should be unaffected
    expect(handler.id).toBe('original-id');
    expect(handler.name).toBe('Original Name');
  });
});
