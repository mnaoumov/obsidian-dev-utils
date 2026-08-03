/**
 * @file
 *
 * Integration tests for {@link NotebookNavigatorMenuEventRegistrarComponent}, run against a live
 * Obsidian instance.
 *
 * The bridge's correctness rests on real `Menu` behavior a mock cannot reproduce: `Menu.items` is
 * what tells it whether the handlers contributed anything, `MenuItem.setSubmenu()` is what the
 * handlers write into, and `Menu.sort()` is what would fold a handler's own section submenu into a
 * SECOND, nested plugin-titled entry — the exact bug the forced-off
 * `CommandHandlerRegistrationContext.shouldAddCommandToSubmenu` exists to prevent.
 *
 * Notebook Navigator itself is not installed in the test vault; a stand-in exposing the same `menus`
 * API is seeded into the plugin registry, so what runs here is every part this library owns.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import type {
  Menu,
  MenuItem,
  TAbstractFile
} from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { AbstractFileCommandHandlerShouldAddToAbstractFileMenuParams } from '../command-handlers/abstract-file-command-handler.ts';
import type {
  NotebookNavigatorFileMenuContext,
  NotebookNavigatorFolderMenuContext
} from '../notebook-navigator.ts';

const COMMAND_ITEM_TITLE = 'Notebook Navigator bridge command';

interface NotebookNavigatorMenuResult {
  readonly hasNestedSubmenu: boolean;
  readonly parentItemTitles: string[];
  readonly pluginName: string;
  readonly submenuTitles: string[];
  readonly titlesForGatedOutFile: string[];
}

describe('NotebookNavigatorMenuEventRegistrarComponent', () => {
  it('should contribute exactly one plugin-titled entry, with no nested duplicate inside it', async () => {
    const result = await evalInObsidian({
      // eslint-disable-next-line unicorn/name-replacements -- `fn` is declared by `obsidian-integration-testing`; renaming it here would not match the API.
      async fn(
        {
          app,
          lib: {
            AbstractFileCommandHandler,
            AppActiveFileProvider,
            castTo,
            CommandHandlerComponent,
            MenuEventRegistrarComponent,
            NOTEBOOK_NAVIGATOR_PLUGIN_ID,
            NotebookNavigatorMenuEventRegistrarComponent,
            PluginCommandRegistrar,
            waitUntil
          },
          obsidianModule
        }
      ): Promise<NotebookNavigatorMenuResult> {
        const HARNESS_PLUGIN_ID = 'obsidian-dev-utils-integration-test';
        const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;
        // Kept in step with the module-level constant the assertions below compare against; the
        // Closure is serialized, so it cannot read one.
        const COMMAND_NAME = 'Notebook Navigator bridge command';
        const MATCHING_FILE_PATH = 'notebook-navigator-bridge-test.md';
        const GATED_OUT_FILE_PATH = 'notebook-navigator-bridge-test-gated-out.md';

        const harnessPlugin = app.plugins.getPlugin(HARNESS_PLUGIN_ID);
        if (!harnessPlugin) {
          throw new Error(`Harness plugin "${HARNESS_PLUGIN_ID}" is not loaded`);
        }

        const fileMenuCallbacks: ((context: NotebookNavigatorFileMenuContext) => void)[] = [];
        const folderMenuCallbacks: ((context: NotebookNavigatorFolderMenuContext) => void)[] = [];

        // A stand-in for Notebook Navigator, exposing exactly the API slice the bridge narrows to.
        const fakeNotebookNavigator = {
          api: {
            menus: {
              registerFileMenu: (callback: (context: NotebookNavigatorFileMenuContext) => void): () => void => {
                fileMenuCallbacks.push(callback);
                return (): void => {
                  fileMenuCallbacks.length = 0;
                };
              },
              registerFolderMenu: (callback: (context: NotebookNavigatorFolderMenuContext) => void): () => void => {
                folderMenuCallbacks.push(callback);
                return (): void => {
                  folderMenuCallbacks.length = 0;
                };
              }
            }
          }
        };

        /**
         * Raises a Notebook Navigator file menu and collects what the bridge contributed.
         *
         * @param file - The right-clicked file.
         * @returns A real menu holding the contributed items.
         */
        function raiseFileMenu(file: TAbstractFile): Menu {
          const menu = new obsidianModule.Menu();
          const context: NotebookNavigatorFileMenuContext = {
            addItem: (callback: (item: MenuItem) => void): void => {
              menu.addItem(callback);
            },
            file: castTo(file),
            selection: {
              files: [castTo(file)],
              mode: 'single'
            }
          };

          for (const callback of fileMenuCallbacks) {
            callback(context);
          }

          menu.sort();
          return menu;
        }

        /**
         * Reads the visible titles of a menu's items.
         *
         * @param menu - The menu to read.
         * @returns The titles, in menu order.
         */
        function titlesOf(menu: Menu): string[] {
          // `Menu.items` also carries separators, which have no title.
          return menu.items.filter((item) => 'titleEl' in item).map((item) => item.titleEl.textContent);
        }

        /**
         * A handler that offers itself only for the matching file, and asks for a section submenu of
         * its own — so the bridging surface's forced-off override is what has to suppress it.
         */
        class BridgeCommandHandler extends AbstractFileCommandHandler {
          protected override executeAbstractFile(): void {
            // Nothing to execute: this test only looks at what reaches the menu.
          }

          protected override shouldAddToAbstractFileMenu(params: AbstractFileCommandHandlerShouldAddToAbstractFileMenuParams): boolean {
            return params.abstractFile.path === MATCHING_FILE_PATH;
          }
        }

        const matchingFile = await app.vault.create(MATCHING_FILE_PATH, '');
        const gatedOutFile = await app.vault.create(GATED_OUT_FILE_PATH, '');

        const menuEventRegistrar = new MenuEventRegistrarComponent(app);
        const notebookNavigatorMenuEventRegistrar = new NotebookNavigatorMenuEventRegistrarComponent({
          app,
          pluginName: harnessPlugin.manifest.name,
          submenuIcon: 'wand'
        });
        const commandHandlerComponent = new CommandHandlerComponent({
          activeFileProvider: new AppActiveFileProvider(app),
          additionalMenuEventRegistrars: [notebookNavigatorMenuEventRegistrar],
          commandRegistrar: new PluginCommandRegistrar(harnessPlugin),
          menuEventRegistrar,
          pluginName: harnessPlugin.manifest.name
        });

        const pluginsRecord = castTo<Record<string, unknown>>(app.plugins.plugins);
        const originalNotebookNavigator = pluginsRecord[NOTEBOOK_NAVIGATOR_PLUGIN_ID];
        pluginsRecord[NOTEBOOK_NAVIGATOR_PLUGIN_ID] = fakeNotebookNavigator;

        try {
          if (!app.plugins.getPlugin(NOTEBOOK_NAVIGATOR_PLUGIN_ID)) {
            throw new Error('The seeded Notebook Navigator stand-in is not visible through `app.plugins.getPlugin`');
          }

          menuEventRegistrar.load();
          notebookNavigatorMenuEventRegistrar.load();
          commandHandlerComponent.load();
          commandHandlerComponent.registerCommandHandlers(() => [
            new BridgeCommandHandler({
              icon: 'wand',
              id: 'notebook-navigator-bridge-test-cmd',
              name: COMMAND_NAME,
              shouldAddCommandToSubmenu: true
            })
          ]);

          // The bridge binds at layout-ready and `onRegistered` runs fire-and-forget.
          await waitUntil({
            message: 'the bridge registered a file-menu contributor and collected the handler',
            predicate: (): boolean => fileMenuCallbacks.length > 0 && raiseFileMenu(matchingFile).items.length > 0,
            timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
          });

          const matchingMenu = raiseFileMenu(matchingFile);
          const parentItemTitles = titlesOf(matchingMenu);

          const parentItem = matchingMenu.items[0];
          const submenu = parentItem && 'submenu' in parentItem ? parentItem.submenu : null;
          if (!submenu) {
            throw new Error('The contributed entry carries no submenu');
          }

          // Sorting the SUBMENU is what would materialize a nested plugin-titled entry, had the
          // Handler's own section submenu survived.
          submenu.sort();
          const submenuTitles = titlesOf(submenu);
          const hasNestedSubmenu = submenu.items.some((item) => 'submenu' in item && item.submenu !== null);

          return {
            hasNestedSubmenu,
            parentItemTitles,
            pluginName: harnessPlugin.manifest.name,
            submenuTitles,
            titlesForGatedOutFile: titlesOf(raiseFileMenu(gatedOutFile))
          };
        } finally {
          commandHandlerComponent.unload();
          notebookNavigatorMenuEventRegistrar.unload();
          menuEventRegistrar.unload();
          if (originalNotebookNavigator === undefined) {
            Reflect.deleteProperty(pluginsRecord, NOTEBOOK_NAVIGATOR_PLUGIN_ID);
          } else {
            pluginsRecord[NOTEBOOK_NAVIGATOR_PLUGIN_ID] = originalNotebookNavigator;
          }
          await app.fileManager.trashFile(matchingFile);
          await app.fileManager.trashFile(gatedOutFile);
        }
      }
    });

    // ONE entry, titled with the plugin name — not one per command, and not a second nested one.
    expect(result.parentItemTitles).toEqual([result.pluginName]);
    // The command sits directly in the submenu: the handler asked for a section submenu of its own and
    // The bridging surface forced it off, so `Menu.sort()` had nothing to nest.
    expect(result.submenuTitles).toEqual([COMMAND_ITEM_TITLE]);
    expect(result.hasNestedSubmenu).toBe(false);
    // A file the handler gates out gets nothing at all — Notebook Navigator's `addItem` cannot be
    // Taken back, so the bridge has to stay out of the menu entirely.
    expect(result.titlesForGatedOutFile).toEqual([]);
  });
});
