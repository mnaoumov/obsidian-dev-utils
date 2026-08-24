/**
 * @file
 *
 * Tests for {@link NotebookNavigatorMenuEventRegistrarComponent}.
 */

import type {
  App as AppOriginal,
  Menu as MenuOriginal,
  Plugin as PluginOriginal,
  TFile as TFileOriginal,
  TFolder as TFolderOriginal
} from 'obsidian';
import type { MenuItem } from 'obsidian-test-mocks/obsidian';

import { Menu } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type {
  NotebookNavigatorFileMenuContext,
  NotebookNavigatorFolderMenuContext
} from '../notebook-navigator.ts';

import {
  sleep,
  waitForAllAsyncOperations
} from '../../async.ts';
import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { ensureNonNullable } from '../../type-guards.ts';
import { NOTEBOOK_NAVIGATOR_MENU_SOURCE } from '../notebook-navigator.ts';
import { NotebookNavigatorMenuEventRegistrarComponent } from './notebook-navigator-menu-event-registrar-component.ts';

/**
 * What a fake Notebook Navigator records about the registrations it receives.
 */
interface FakeNotebookNavigator {
  disposeCount: number;
  readonly fileMenuCallbacks: FileMenuCallback[];
  readonly folderMenuCallbacks: FolderMenuCallback[];
  plugin: unknown;
}

type FileMenuCallback = (context: NotebookNavigatorFileMenuContext) => void;

type FolderMenuCallback = (context: NotebookNavigatorFolderMenuContext) => void;

/**
 * The mock menu's own item list, which the bridge below surfaces as `items`.
 */
interface MenuWithItemsRecord {
  items__: unknown[];
}

const PLUGIN_NAME = 'Test Plugin';
const SUBMENU_ICON = 'wand';

let app: AppOriginal;
let notebookNavigator: FakeNotebookNavigator;
let triggerLayoutReady: () => void;

/**
 * Teaches the mock menu the one `obsidian-typings` member the component reads.
 *
 * `Menu.items` is how the component tells whether the handlers contributed anything, and
 * `obsidian-test-mocks` models it only as `items__` — it bridges `MenuItem.setSubmenu` / `.submenu`
 * but not this. The mock is a STRICT proxy, so an unmocked read throws rather than returning
 * `undefined`; defining the property on the prototype is the same shape as the library's own
 * `bridgeMenuItem`, applied one member further.
 *
 * TODO (T329-P35): drop this once `obsidian-test-mocks` bridges `Menu.items`.
 */
function bridgeMenuItems(): void {
  Object.defineProperty(Menu.prototype, 'items', {
    configurable: true,
    get(this: MenuWithItemsRecord): unknown[] {
      return this.items__;
    }
  });
}

/**
 * Builds an app whose plugin registry holds the given Notebook Navigator.
 *
 * @param shouldInstallNotebookNavigator - Whether the app has Notebook Navigator.
 * @returns The app.
 */
function createApp(shouldInstallNotebookNavigator: boolean): AppOriginal {
  let layoutReadyCallback: (() => void) | undefined;
  triggerLayoutReady = (): void => {
    layoutReadyCallback?.();
  };

  return strictProxy<AppOriginal>({
    plugins: {
      getPlugin: (): null | PluginOriginal => shouldInstallNotebookNavigator ? castTo<PluginOriginal>(notebookNavigator.plugin) : null
    },
    workspace: {
      onLayoutReady: vi.fn((callback: () => void) => {
        layoutReadyCallback = callback;
      })
    }
  });
}

/**
 * Builds a fake Notebook Navigator, recording every registration it receives.
 *
 * @returns The fake, plus the plugin object to install in the app.
 */
function createFakeNotebookNavigator(): FakeNotebookNavigator {
  const fake: FakeNotebookNavigator = {
    disposeCount: 0,
    fileMenuCallbacks: [],
    folderMenuCallbacks: [],
    plugin: null
  };

  fake.plugin = {
    api: {
      menus: {
        registerFileMenu: (callback: FileMenuCallback): () => void => {
          fake.fileMenuCallbacks.push(callback);
          return (): void => {
            fake.disposeCount++;
          };
        },
        registerFolderMenu: (callback: FolderMenuCallback): () => void => {
          fake.folderMenuCallbacks.push(callback);
          return (): void => {
            fake.disposeCount++;
          };
        }
      }
    }
  };

  return fake;
}

function createMockFile(path: string): TFileOriginal {
  return strictProxy<TFileOriginal>({ path });
}

function createMockFolder(path: string): TFolderOriginal {
  return strictProxy<TFolderOriginal>({ path });
}

/**
 * Loads the component and lets its layout-ready binding run.
 *
 * @param shouldInstallNotebookNavigator - Whether the app has Notebook Navigator.
 * @param shouldSupplySubmenuIcon - Whether the parent entry is given an icon.
 * @returns The loaded component.
 */
async function loadComponent(
  shouldInstallNotebookNavigator = true,
  shouldSupplySubmenuIcon = true
): Promise<NotebookNavigatorMenuEventRegistrarComponent> {
  app = createApp(shouldInstallNotebookNavigator);

  const component = new NotebookNavigatorMenuEventRegistrarComponent(
    shouldSupplySubmenuIcon
      ? {
        app,
        pluginName: PLUGIN_NAME,
        submenuIcon: SUBMENU_ICON
      }
      : {
        app,
        pluginName: PLUGIN_NAME
      }
  );
  component.load();
  triggerLayoutReady();
  // `LayoutReadyComponent` defers through a `window.setTimeout` and then through `invokeAsyncSafely`,
  // So both a macrotask and the async-operation drain are needed before the menus are bound.
  await sleep({ milliseconds: 0 });
  await waitForAllAsyncOperations();
  return component;
}

/**
 * Raises a file menu on the fake Notebook Navigator.
 *
 * @param file - The right-clicked file.
 * @param selectedFiles - Every selected file; more than one means a multi-selection.
 * @returns The items the component contributed, as the mocks record them.
 */
function raiseFileMenu(file: TFileOriginal, selectedFiles: TFileOriginal[] = [file]): MenuItem[] {
  const menu = Menu.create2__();
  const context: NotebookNavigatorFileMenuContext = {
    addItem: (callback): void => {
      menu.addItem(callback);
    },
    file,
    selection: {
      files: selectedFiles,
      mode: selectedFiles.length > 1 ? 'multiple' : 'single'
    }
  };

  for (const callback of notebookNavigator.fileMenuCallbacks) {
    callback(context);
  }

  return menu.menuItems__;
}

/**
 * Raises a folder menu on the fake Notebook Navigator.
 *
 * @param folder - The right-clicked folder.
 * @returns The items the component contributed, as the mocks record them.
 */
function raiseFolderMenu(folder: TFolderOriginal): MenuItem[] {
  const menu = Menu.create2__();
  const context: NotebookNavigatorFolderMenuContext = {
    addItem: (callback): void => {
      menu.addItem(callback);
    },
    folder
  };

  for (const callback of notebookNavigator.folderMenuCallbacks) {
    callback(context);
  }

  return menu.menuItems__;
}

/**
 * The titles inside the parent entry the component contributed.
 *
 * @param items - The items a menu collected.
 * @returns The submenu titles, in menu order.
 */
function submenuTitles(items: MenuItem[]): unknown[] {
  const parentItem = ensureNonNullable(items[0]);
  return ensureNonNullable(parentItem.submenu__).menuItems__.map((item) => item.title__);
}

beforeEach(() => {
  bridgeMenuItems();
  notebookNavigator = createFakeNotebookNavigator();
});

afterEach(() => {
  // The bridge is a prototype-level patch on a shared class; leave it as found.
  delete castTo<Record<string, unknown>>(Menu.prototype)['items'];
});

describe('NotebookNavigatorMenuEventRegistrarComponent', () => {
  describe('binding', () => {
    it('should register a file and a folder menu contributor with Notebook Navigator', async () => {
      await loadComponent();

      expect(notebookNavigator.fileMenuCallbacks).toHaveLength(1);
      expect(notebookNavigator.folderMenuCallbacks).toHaveLength(1);
    });

    it('should stay dormant when Notebook Navigator is not installed', async () => {
      const component = await loadComponent(false);

      expect(notebookNavigator.fileMenuCallbacks).toHaveLength(0);
      expect(notebookNavigator.folderMenuCallbacks).toHaveLength(0);
      component.unload();
    });

    it('should unregister both contributors when it unloads', async () => {
      const component = await loadComponent();

      component.unload();

      expect(notebookNavigator.disposeCount).toBe(2);
    });

    it('should ignore an editor-menu registration, which Notebook Navigator has no menu for', async () => {
      const component = await loadComponent();

      const disposable = component.registerEditorMenuEventHandler(() => {
        throw new Error('The editor-menu handler must never be invoked.');
      });
      disposable.dispose();

      expect(notebookNavigator.fileMenuCallbacks).toHaveLength(1);
    });

    it('should ignore a markdown-viewport-menu registration, which Notebook Navigator has no menu for', async () => {
      const component = await loadComponent();

      const disposable = component.registerMarkdownViewportMenuEventHandler(() => {
        throw new Error('The markdown-viewport-menu handler must never be invoked.');
      });
      disposable.dispose();

      expect(notebookNavigator.fileMenuCallbacks).toHaveLength(1);
    });

    it('should drop a file-menu handler once its registration is disposed', async () => {
      const component = await loadComponent();
      const disposable = component.registerFileMenuEventHandler((menu) => {
        menu.addItem((item) => {
          item.setTitle('Extra');
        });
      });

      expect(submenuTitles(raiseFileMenu(createMockFile('note.md')))).toEqual(['Extra']);

      disposable.dispose();

      expect(raiseFileMenu(createMockFile('note.md'))).toHaveLength(0);
    });

    it('should drop a multi-file menu handler once its registration is disposed', async () => {
      const component = await loadComponent();
      const disposable = component.registerFilesMenuEventHandler((menu) => {
        menu.addItem((item) => {
          item.setTitle('Extra');
        });
      });
      const file = createMockFile('note.md');
      const secondFile = createMockFile('second.md');

      expect(submenuTitles(raiseFileMenu(file, [file, secondFile]))).toEqual(['Extra']);

      disposable.dispose();

      expect(raiseFileMenu(file, [file, secondFile])).toHaveLength(0);
    });

    it('should drop every collected handler when it unloads', async () => {
      const component = await loadComponent();
      component.registerFileMenuEventHandler((menu) => {
        menu.addItem((item) => {
          item.setTitle('Extra');
        });
      });
      const { fileMenuCallbacks } = notebookNavigator;

      component.unload();

      // The contributor is gone from Notebook Navigator, but invoking the captured one must also
      // Contribute nothing, so a stale reference cannot resurrect an unloaded plugin's items.
      const menu = Menu.create2__();
      const file = createMockFile('note.md');
      for (const callback of fileMenuCallbacks) {
        callback({
          addItem: (itemCallback): void => {
            menu.addItem(itemCallback);
          },
          file,
          selection: {
            files: [file],
            mode: 'single'
          }
        });
      }

      expect(menu.items__).toHaveLength(0);
    });
  });

  describe('contributing', () => {
    it('should add nothing at all when the handlers contribute nothing', async () => {
      const component = await loadComponent();
      component.registerFileMenuEventHandler(() => {
        // Deliberately contributes nothing, as a gated handler does.
      });

      expect(raiseFileMenu(createMockFile('note.md'))).toHaveLength(0);
    });

    it('should add exactly one parent entry, carrying the plugin name and icon', async () => {
      const component = await loadComponent();
      component.registerFileMenuEventHandler((menu) => {
        menu.addItem((item) => {
          item.setTitle('First');
        });
        menu.addItem((item) => {
          item.setTitle('Second');
        });
      });

      const items = raiseFileMenu(createMockFile('note.md'));

      expect(items).toHaveLength(1);
      expect(ensureNonNullable(items[0]).title__).toBe(PLUGIN_NAME);
      expect(ensureNonNullable(items[0]).icon__).toBe(SUBMENU_ICON);
      expect(submenuTitles(items)).toEqual(['First', 'Second']);
    });

    it('should leave the parent entry without an icon when none was supplied', async () => {
      const component = await loadComponent(true, false);
      component.registerFileMenuEventHandler((menu) => {
        menu.addItem((item) => {
          item.setTitle('First');
        });
      });

      const items = raiseFileMenu(createMockFile('note.md'));

      expect(ensureNonNullable(items[0]).icon__).toBe('');
    });
  });

  describe('file menu', () => {
    it('should route a single selection to the single-file handlers, with the right-clicked file', async () => {
      const component = await loadComponent();
      const fileMenuEventHandler = vi.fn();
      component.registerFileMenuEventHandler(fileMenuEventHandler);
      const file = createMockFile('note.md');

      raiseFileMenu(file);

      expect(fileMenuEventHandler).toHaveBeenCalledWith(expect.anything(), file, NOTEBOOK_NAVIGATOR_MENU_SOURCE);
    });

    it('should route a multi-selection to the multi-file handlers, with every selected file', async () => {
      const component = await loadComponent();
      const filesMenuEventHandler = vi.fn((menu: MenuOriginal) => {
        menu.addItem((item) => {
          item.setTitle('Multi');
        });
      });
      component.registerFilesMenuEventHandler(filesMenuEventHandler);
      const file = createMockFile('note.md');
      const secondFile = createMockFile('second.md');

      expect(submenuTitles(raiseFileMenu(file, [file, secondFile]))).toEqual(['Multi']);
      expect(filesMenuEventHandler).toHaveBeenCalledWith(expect.anything(), [file, secondFile], NOTEBOOK_NAVIGATOR_MENU_SOURCE);
    });

    it('should not run the multi-file handlers for a single selection', async () => {
      const component = await loadComponent();
      const filesMenuEventHandler = vi.fn();
      component.registerFilesMenuEventHandler(filesMenuEventHandler);

      raiseFileMenu(createMockFile('note.md'));

      expect(filesMenuEventHandler).not.toHaveBeenCalled();
    });
  });

  describe('folder menu', () => {
    it('should route a folder through the single-file handlers', async () => {
      const component = await loadComponent();
      const fileMenuEventHandler = vi.fn((menu: MenuOriginal) => {
        menu.addItem((item) => {
          item.setTitle('Folder item');
        });
      });
      component.registerFileMenuEventHandler(fileMenuEventHandler);
      const folder = createMockFolder('Notes');

      expect(submenuTitles(raiseFolderMenu(folder))).toEqual(['Folder item']);
      expect(fileMenuEventHandler).toHaveBeenCalledWith(expect.anything(), folder, NOTEBOOK_NAVIGATOR_MENU_SOURCE);
    });
  });
});
