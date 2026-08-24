/**
 * @file
 *
 * Integration tests for {@link EditorCommandHandler}'s markdown viewport (margin) menu support, run
 * against a live Obsidian instance.
 *
 * A unit test drives a mocked registrar and a hand-rolled menu. This drives the REAL workspace event bus,
 * a REAL `MarkdownView` and a REAL `Menu`, so the whole chain is exercised: registration through
 * `MenuEventRegistrarComponent` → `CommandHandlerComponent` → `EditorCommandHandler.handleViewportMenu`,
 * including that a `MarkdownView` really does serve as both the `Editor` source and the
 * `MarkdownFileInfo` context - the assumption that lets this menu reuse `canExecuteEditor` /
 * `executeEditor` with no new abstract surface.
 *
 * What it deliberately does NOT cover: the DOM path. Obsidian's own `cm.scrollDOM` listener gates on
 * `e.isTrusted`, so a dispatched `MouseEvent` is ignored, and the harness exposes no way to inject a
 * trusted input event. That a margin right-click reaches THIS event (and not `editor-menu`) therefore
 * rests on reading `obsidian-1.13.7.asar`, where the listener skips only when the target is inside
 * `sizerEl` and not under `.cm-gutters`.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import type {
  Editor,
  MarkdownFileInfo,
  MarkdownView
} from 'obsidian';
import type { Promisable } from 'type-fest';

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

/**
 * The names the assertions look for. The callback below is serialized and run inside Obsidian, so it
 * cannot close over these - it repeats the literals, and the two must stay in step.
 */
const OPTED_IN_COMMAND_NAME = 'Viewport Menu Opted In';
const OPTED_OUT_COMMAND_NAME = 'Viewport Menu Opted Out';
const PLUGIN_SECTION = 'Viewport Menu Test Plugin';

interface ViewportMenuResult {
  readonly menuItemTitles: readonly string[];
  readonly optedInItemSection: null | string;
  readonly wasContextTheView: boolean;
  readonly wasEditorTheViewEditor: boolean;
}

describe('EditorCommandHandler viewport menu', () => {
  it('should contribute an opted-in command to a real markdown-viewport-menu, and nothing when opted out', async () => {
    const result = await evalInObsidian({
      async callback(
        {
          app,
          lib: { AppActiveFileProvider, CommandHandlerComponent, EditorCommandHandler, MenuEventRegistrarComponent, PluginCommandRegistrar },
          obsidianModule
        }
      ): Promise<ViewportMenuResult> {
        const HARNESS_PLUGIN_ID = 'obsidian-dev-utils-integration-test';

        const harnessPlugin = app.plugins.getPlugin(HARNESS_PLUGIN_ID);
        if (!harnessPlugin) {
          throw new Error(`Harness plugin "${HARNESS_PLUGIN_ID}" is not loaded`);
        }

        let receivedContext: unknown = null;
        let receivedEditor: unknown = null;

        class OptedInHandler extends EditorCommandHandler {
          protected override canExecuteEditor(editor: Editor, context: MarkdownFileInfo): boolean {
            receivedContext = context;
            receivedEditor = editor;
            return true;
          }

          protected override executeEditor(): Promisable<void> {
            // Nothing to do - this test only asserts that the item reaches the menu.
          }

          protected override shouldAddToViewportMenu(): boolean {
            return true;
          }
        }

        // No `shouldAddToViewportMenu` override at all, so it takes the base class's `false`.
        // That default exists so an existing consumer gains nothing it did not ask for.
        class OptedOutHandler extends EditorCommandHandler {
          protected override executeEditor(): Promisable<void> {
            // Nothing to do - this handler must never reach the menu.
          }
        }

        const menuEventRegistrar = new MenuEventRegistrarComponent(app);
        menuEventRegistrar.load();
        const commandHandlerComponent = new CommandHandlerComponent({
          activeFileProvider: new AppActiveFileProvider(app),
          commandRegistrar: new PluginCommandRegistrar(harnessPlugin),
          menuEventRegistrar,
          pluginName: 'Viewport Menu Test Plugin'
        });
        commandHandlerComponent.load();

        const file = await app.vault.create('viewport-menu-test.md', 'Some text to give the editor a line.');
        const leaf = app.workspace.getLeaf('tab');

        try {
          await leaf.openFile(file, { state: { mode: 'source', source: false } });
          const view = leaf.view as MarkdownView;

          await commandHandlerComponent.registerCommandHandlers(() => [
            new OptedInHandler({
              icon: 'lock',
              id: 'viewport-menu-opted-in-cmd',
              name: 'Viewport Menu Opted In'
            }),
            new OptedOutHandler({
              icon: 'lock',
              id: 'viewport-menu-opted-out-cmd',
              name: 'Viewport Menu Opted Out'
            })
          ]);

          // The sections Obsidian's own trigger declares.
          // An item in the plugin's section therefore sorts here exactly as it does in the real menu.
          const menu = new obsidianModule.Menu().addSections(['view', '']);
          app.workspace.trigger('markdown-viewport-menu', menu, view, 'source', 'gutter');

          const items = menu.items.filter((item) => 'titleEl' in item);
          const optedInItem = items.find((item) => item.titleEl.textContent === 'Viewport Menu Opted In');

          return {
            menuItemTitles: items.map((item) => item.titleEl.textContent),
            optedInItemSection: optedInItem?.section ?? null,
            wasContextTheView: receivedContext === view,
            wasEditorTheViewEditor: receivedEditor === view.editor
          };
        } finally {
          leaf.detach();
          commandHandlerComponent.unload();
          menuEventRegistrar.unload();
          await app.fileManager.trashFile(file);
        }
      }
    });

    expect(result.menuItemTitles).toContain(OPTED_IN_COMMAND_NAME);
    // The default is `false`, so a handler that never mentions the viewport menu stays out of it.
    expect(result.menuItemTitles).not.toContain(OPTED_OUT_COMMAND_NAME);
    // The item lands in the handler's own section, not Obsidian's `view` section, so it sorts below the
    // `Readable line length` / `Line numbers` / `Inline title` toggles.
    expect(result.optedInItemSection).toBe(PLUGIN_SECTION);
    // `MarkdownView` serves as both the editor source and the `MarkdownFileInfo` context.
    // That is what lets this menu reuse `canExecuteEditor` / `executeEditor` unchanged.
    expect(result.wasEditorTheViewEditor).toBe(true);
    expect(result.wasContextTheView).toBe(true);
  });
});
