/**
 * @file
 *
 * Integration tests for {@link CommandHandlerComponent} teardown, run against a live Obsidian instance. A
 * unit test can only assert that a mocked `offref` or `removeCommand` was called; these drive the REAL
 * Obsidian workspace event bus and the REAL command registry.
 *
 * Two things are confirmed here that no mock can show. First, that disposing the {@link Disposable} returned
 * by `registerCommandHandlers` genuinely unregisters a command's `file-menu` contribution, so the handler
 * stops firing afterwards. Second, that a batch's LIFETIME OWNER unloading genuinely takes the command out of
 * `app.commands.commands` — which the mock `Plugin` cannot prove, because it does not prefix command ids
 * the way the real one does, and the whole point of the id being captured before `addCommand` is that a
 * re-prefixed id removes nothing at all.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import type { Command } from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { CommandHandlerRegistrationContext } from './command-handler.ts';

interface LifetimeOwnerResult {
  readonly isComponentStillLoadedAfterUnload: boolean;
  readonly isRegisteredAfterUnload: boolean;
  readonly isRegisteredBeforeUnload: boolean;
}

interface MenuTeardownResult {
  readonly countAfterDispose: number;
  readonly countAfterFirstTrigger: number;
}

describe('CommandHandlerComponent menu-event teardown', () => {
  it('should unregister a command handler\'s file-menu contribution when the returned disposable is disposed', async () => {
    const result = await evalInObsidian({
      async callback(
        { app, lib: { AppActiveFileProvider, CommandHandler, CommandHandlerComponent, MenuEventRegistrarComponent, PluginCommandRegistrar }, obsidianModule }
      ): Promise<MenuTeardownResult> {
        const HARNESS_PLUGIN_ID = 'obsidian-dev-utils-integration-test';

        const harnessPlugin = app.plugins.getPlugin(HARNESS_PLUGIN_ID);
        if (!harnessPlugin) {
          throw new Error(`Harness plugin "${HARNESS_PLUGIN_ID}" is not loaded`);
        }

        let fileMenuCallCount = 0;

        class FileMenuHandler extends CommandHandler {
          public override buildCommand(): Command {
            return {
              icon: 'lock',
              id: 'menu-teardown-test-cmd',
              name: 'Menu Teardown Test Command'
            };
          }

          public override async onRegistered(context: CommandHandlerRegistrationContext): Promise<void> {
            await super.onRegistered(context);
            context.menuEventRegistrar.registerFileMenuEventHandler(() => {
              fileMenuCallCount++;
            });
          }
        }

        const menuEventRegistrar = new MenuEventRegistrarComponent(app);
        menuEventRegistrar.load();
        const commandHandlerComponent = new CommandHandlerComponent({
          activeFileProvider: new AppActiveFileProvider(app),
          commandRegistrar: new PluginCommandRegistrar(harnessPlugin),
          menuEventRegistrar,
          pluginName: harnessPlugin.manifest.name
        });
        commandHandlerComponent.load();

        const file = await app.vault.create('menu-teardown-test.md', '');

        try {
          const disposable = await commandHandlerComponent.registerCommandHandlers(() => [
            new FileMenuHandler({
              icon: 'lock',
              id: 'menu-teardown-test-cmd',
              name: 'Menu Teardown Test Command'
            })
          ]);

          // `registerCommandHandlers` awaits `onRegistered`, so the file-menu handler is live by now —
          // no polling needed, a single trigger must already reach it.
          app.workspace.trigger('file-menu', new obsidianModule.Menu(), file, 'integration-test');
          const countAfterFirstTrigger = fileMenuCallCount;

          disposable[Symbol.dispose]();

          // After dispose the file-menu registration is gone, so a further trigger must not run the handler.
          app.workspace.trigger('file-menu', new obsidianModule.Menu(), file, 'integration-test');
          const countAfterDispose = fileMenuCallCount;

          return {
            countAfterDispose,
            countAfterFirstTrigger
          };
        } finally {
          commandHandlerComponent.unload();
          menuEventRegistrar.unload();
          await app.fileManager.trashFile(file);
        }
      }
    });

    expect(result.countAfterFirstTrigger).toBeGreaterThanOrEqual(1);
    // Disposing removed the file-menu registration, so the post-dispose trigger did not increment the count.
    expect(result.countAfterDispose).toBe(result.countAfterFirstTrigger);
  });

  it('should remove a command from the real command registry when its lifetime owner unloads, leaving the registering component running', async () => {
    const result = await evalInObsidian({
      async callback(
        { app, lib: { AppActiveFileProvider, CommandHandler, CommandHandlerComponent, ComponentEx, MenuEventRegistrarComponent, PluginCommandRegistrar } }
      ): Promise<LifetimeOwnerResult> {
        const HARNESS_PLUGIN_ID = 'obsidian-dev-utils-integration-test';
        const COMMAND_ID = 'lifetime-owner-test-cmd';
        const FULL_COMMAND_ID = `${HARNESS_PLUGIN_ID}:${COMMAND_ID}`;

        const harnessPlugin = app.plugins.getPlugin(HARNESS_PLUGIN_ID);
        if (!harnessPlugin) {
          throw new Error(`Harness plugin "${HARNESS_PLUGIN_ID}" is not loaded`);
        }

        class PlainHandler extends CommandHandler {
          public override buildCommand(): Command {
            return {
              icon: 'lock',
              id: COMMAND_ID,
              name: 'Lifetime Owner Test Command'
            };
          }
        }

        const menuEventRegistrar = new MenuEventRegistrarComponent(app);
        menuEventRegistrar.load();

        // Stands in for the wrapper `PluginBase` holds its feature surface in: a component with a SHORTER
        // life than the command component, which the dependency gate unloads and replaces underneath it.
        const lifetimeOwner = new ComponentEx();
        lifetimeOwner.load();

        const commandHandlerComponent = new CommandHandlerComponent({
          activeFileProvider: new AppActiveFileProvider(app),
          commandLifetimeOwnerProvider: (): typeof lifetimeOwner => lifetimeOwner,
          commandRegistrar: new PluginCommandRegistrar(harnessPlugin),
          menuEventRegistrar,
          pluginName: harnessPlugin.manifest.name
        });
        commandHandlerComponent.load();

        try {
          await commandHandlerComponent.registerCommandHandlers(() => [
            new PlainHandler({
              icon: 'lock',
              id: COMMAND_ID,
              name: 'Lifetime Owner Test Command'
            })
          ]);
          const isRegisteredBeforeUnload = app.commands.commands[FULL_COMMAND_ID] !== undefined;

          lifetimeOwner.unload();

          return {
            isComponentStillLoadedAfterUnload: commandHandlerComponent._loaded,
            isRegisteredAfterUnload: app.commands.commands[FULL_COMMAND_ID] !== undefined,
            isRegisteredBeforeUnload
          };
        } finally {
          commandHandlerComponent.unload();
          menuEventRegistrar.unload();
        }
      }
    });

    expect(result.isRegisteredBeforeUnload).toBe(true);
    // The command left the palette with the surface, and the component that registered it is still running —
    // which is exactly the shape a blocked plugin needs: no dead commands, but the notice still live.
    expect(result.isRegisteredAfterUnload).toBe(false);
    expect(result.isComponentStillLoadedAfterUnload).toBe(true);
  });
});
