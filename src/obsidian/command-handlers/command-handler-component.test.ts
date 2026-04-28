/**
 * @file
 *
 * Tests for {@link CommandHandlerComponent}.
 */

import type { Command } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ActiveFileProvider } from '../active-file-provider.ts';
import type { CommandRegistrar } from '../command-registrar.ts';
import type { MenuEventRegistrar } from '../menu-event-registrar.ts';
import type {
  CommandHandlerParams,
  CommandHandlerRegistrationContext
} from './command-handler.ts';

import { strictProxy } from '../../strict-proxy.ts';
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

function createMockActiveFileProvider(): ActiveFileProvider {
  return strictProxy<ActiveFileProvider>({});
}

function createMockCommandRegistrar(): CommandRegistrar {
  return strictProxy<CommandRegistrar>({
    addCommand: vi.fn(),
    removeCommand: vi.fn()
  });
}

function createMockMenuEventRegistrar(): MenuEventRegistrar {
  return strictProxy<MenuEventRegistrar>({});
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
    const commandHandler = new TestHandler(createParams());
    const commandRegistrar = createMockCommandRegistrar();
    const component = new CommandHandlerComponent({
      activeFileProvider: createMockActiveFileProvider(),
      commandHandlers: [commandHandler],
      commandRegistrar,
      menuEventRegistrar: createMockMenuEventRegistrar()
    });

    await component.onload();

    expect(commandRegistrar.addCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-cmd',
        name: 'Test Command'
      })
    );
  });

  it('should provide registration context with activeFileProvider and menuEventRegistrar', async () => {
    const commandHandler = new TestHandler(createParams());
    const component = new CommandHandlerComponent({
      activeFileProvider: createMockActiveFileProvider(),
      commandHandlers: [commandHandler],
      commandRegistrar: createMockCommandRegistrar(),
      menuEventRegistrar: createMockMenuEventRegistrar()
    });

    await component.onload();

    expect(commandHandler.registeredContext).toBeDefined();
    expect(commandHandler.registeredContext?.activeFileProvider).toBeDefined();
    expect(commandHandler.registeredContext?.menuEventRegistrar).toBeDefined();
  });

  it('should not mutate handler id/name after addCommand', async () => {
    const addCommand = vi.fn((cmd: Command) => {
      // Simulate Obsidian mutating the command
      cmd.id = 'modified-id';
      cmd.name = 'Modified Name';
    });

    const commandRegistrar = createMockCommandRegistrar();
    vi.mocked(commandRegistrar.addCommand).mockImplementation(addCommand);
    const commandHandler = new TestHandler(createParams({ id: 'original-id', name: 'Original Name' }));
    const component = new CommandHandlerComponent({
      activeFileProvider: createMockActiveFileProvider(),
      commandHandlers: [commandHandler],
      commandRegistrar,
      menuEventRegistrar: createMockMenuEventRegistrar()
    });

    await component.onload();

    // Handler should be unaffected
    expect(commandHandler.id).toBe('original-id');
    expect(commandHandler.name).toBe('Original Name');
  });

  it('should call removeCommand on unload', async () => {
    const commandHandler = new TestHandler(createParams({ id: 'my-cmd' }));
    const commandRegistrar = createMockCommandRegistrar();
    const component = new CommandHandlerComponent({
      activeFileProvider: createMockActiveFileProvider(),
      commandHandlers: [commandHandler],
      commandRegistrar,
      menuEventRegistrar: createMockMenuEventRegistrar()
    });

    await component.load();
    component.unload();

    expect(commandRegistrar.removeCommand).toHaveBeenCalledWith('my-cmd');
  });
});
