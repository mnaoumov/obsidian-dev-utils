/**
 * @file
 *
 * Integration tests for {@link CommandHandlerComponent} menu-event teardown, run against a live Obsidian
 * instance. A unit test can only assert that a mocked `offref` was called; this drives the REAL Obsidian
 * workspace event bus to confirm that disposing the {@link Disposable} returned by `registerCommandHandlers`
 * genuinely unregisters a command's `file-menu` contribution (so the handler stops firing afterwards).
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

interface MenuTeardownResult {
  readonly countAfterDispose: number;
  readonly countAfterFirstTrigger: number;
}

describe('CommandHandlerComponent menu-event teardown', () => {
  it('should unregister a command handler\'s file-menu contribution when the returned disposable is disposed', async () => {
    const result = await evalInObsidian({
      async fn(
        { app, lib: { AppActiveFileProvider, CommandHandler, CommandHandlerComponent, MenuEventRegistrarComponent, PluginCommandRegistrar, waitUntil }, obsidianModule }
      ): Promise<MenuTeardownResult> {
        const HARNESS_PLUGIN_ID = 'obsidian-dev-utils-integration-test';
        const BIG_TIMEOUT_IN_MILLISECONDS = 30000;

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
          const disposable = commandHandlerComponent.registerCommandHandlers([
            new FileMenuHandler({
              icon: 'lock',
              id: 'menu-teardown-test-cmd',
              name: 'Menu Teardown Test Command'
            })
          ]);

          // `onRegistered` runs fire-and-forget, so poll (by triggering) until the file-menu handler is live.
          await waitUntil({
            message: 'file-menu handler registered',
            predicate: (): boolean => {
              app.workspace.trigger('file-menu', new obsidianModule.Menu(), file, 'integration-test');
              return fileMenuCallCount > 0;
            },
            timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
          });
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
});
