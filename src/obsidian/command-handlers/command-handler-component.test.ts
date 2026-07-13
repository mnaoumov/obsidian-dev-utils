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
  CommandHandlerConstructorParams,
  CommandHandlerRegistrationContext
} from './command-handler.ts';

import { waitForAllAsyncOperations } from '../../async.ts';
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

function createComponent(commandRegistrar: CommandRegistrar): CommandHandlerComponent {
  return new CommandHandlerComponent({
    activeFileProvider: createMockActiveFileProvider(),
    commandRegistrar,
    menuEventRegistrar: createMockMenuEventRegistrar(),
    pluginName: 'Test Plugin'
  });
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

function createParams(overrides?: Partial<CommandHandlerConstructorParams>): CommandHandlerConstructorParams {
  return {
    icon: 'test-icon',
    id: 'test-cmd',
    name: 'Test Command',
    ...overrides
  };
}

describe('CommandHandlerComponent', () => {
  it('should add the built command via the registrar when handlers are registered', () => {
    const commandRegistrar = createMockCommandRegistrar();
    const component = createComponent(commandRegistrar);

    component.registerCommandHandlers([new TestHandler(createParams())]);

    expect(commandRegistrar.addCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-cmd',
        name: 'Test Command'
      })
    );
  });

  it('should provide registration context with activeFileProvider and menuEventRegistrar', async () => {
    const commandHandler = new TestHandler(createParams());
    const component = createComponent(createMockCommandRegistrar());

    component.registerCommandHandlers([commandHandler]);
    await waitForAllAsyncOperations();

    expect(commandHandler.registeredContext).toBeDefined();
    expect(commandHandler.registeredContext?.activeFileProvider).toBeDefined();
    expect(commandHandler.registeredContext?.menuEventRegistrar).toBeDefined();
  });

  it('should not mutate handler id/name after addCommand', () => {
    const addCommand = vi.fn((command: Command) => {
      // Simulate Obsidian mutating the command.
      command.id = 'modified-id';
      command.name = 'Modified Name';
    });
    const commandRegistrar = createMockCommandRegistrar();
    vi.mocked(commandRegistrar.addCommand).mockImplementation(addCommand);
    const commandHandler = new TestHandler(createParams({ id: 'original-id', name: 'Original Name' }));
    const component = createComponent(commandRegistrar);

    component.registerCommandHandlers([commandHandler]);

    // Handler should be unaffected.
    expect(commandHandler.buildCommand().id).toBe('original-id');
    expect(commandHandler.buildCommand().name).toBe('Original Name');
  });

  it('should removeCommand with the pre-registration id even after addCommand prefixes command.id', () => {
    const commandRegistrar = createMockCommandRegistrar();
    // Mirror Obsidian's Plugin.addCommand, which mutates command.id by prefixing it with the plugin id.
    vi.mocked(commandRegistrar.addCommand).mockImplementation((command: Command) => {
      command.id = `test-plugin:${command.id}`;
    });
    const component = createComponent(commandRegistrar);

    const disposable = component.registerCommandHandlers([new TestHandler(createParams({ id: 'my-cmd' }))]);
    expect(commandRegistrar.removeCommand).not.toHaveBeenCalled();

    disposable[Symbol.dispose]();

    // Plugin.removeCommand re-prefixes, so it must receive the original unprefixed id, not the mutated one.
    expect(commandRegistrar.removeCommand).toHaveBeenCalledWith('my-cmd');
  });

  it('should removeCommand on component unload', () => {
    const commandRegistrar = createMockCommandRegistrar();
    const component = createComponent(commandRegistrar);
    component.load();

    component.registerCommandHandlers([new TestHandler(createParams({ id: 'my-cmd' }))]);
    component.unload();

    expect(commandRegistrar.removeCommand).toHaveBeenCalledWith('my-cmd');
  });
});
