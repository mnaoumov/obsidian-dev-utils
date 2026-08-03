/**
 * @file
 *
 * The slice of Notebook Navigator's public API this library talks to, and the runtime narrowing that
 * gets hold of it.
 *
 * **Notebook Navigator draws its own file tree, so it never raises Obsidian's `file-menu` /
 * `files-menu` workspace events** — which is why a plugin's context-menu items simply disappear for
 * anyone browsing through it. What it offers instead is a documented extension API
 * (`docs/api-reference.md` + `src/api/public/notebook-navigator.d.ts` in `johansan/notebook-navigator`,
 * API 2.0.0), reachable at runtime as `app.plugins.getPlugin('notebook-navigator').api`.
 *
 * The types below are DECLARED HERE rather than imported: Notebook Navigator ships its `.d.ts` for
 * download, not as an npm package, and depending on it would turn an optional integration into a
 * build-time dependency. They are deliberately the narrowest shape this library uses — the API also
 * carries `metadata`, `navigation`, `selection`, `tagCollections`, `propertyNodes` and an event bus,
 * none of which apply to a file/folder command surface.
 */

import type {
  App,
  MenuItem,
  TFile,
  TFolder
} from 'obsidian';

/**
 * Notebook Navigator's public API object, narrowed to what this library uses.
 */
export interface NotebookNavigatorApi {
  /**
   * The menu-extension namespace.
   */
  readonly menus: NotebookNavigatorMenus;
}

/**
 * What `menus.registerFileMenu` hands a subscriber when a FILE is right-clicked.
 *
 * There is no `Menu` here — an item is contributed through `addItem` alone, which is why the
 * file/files menu handlers cannot simply be forwarded to it and have to be bridged (see
 * `components/notebook-navigator-menu-event-registrar-component.ts`).
 */
export interface NotebookNavigatorFileMenuContext extends NotebookNavigatorMenuContext {
  /**
   * The file that was right-clicked.
   */
  readonly file: TFile;

  /**
   * What the tree had selected when the menu was raised.
   */
  readonly selection: NotebookNavigatorFileMenuSelection;
}

/**
 * The selection a file menu was raised on.
 */
export interface NotebookNavigatorFileMenuSelection {
  /**
   * Every selected file, which for `single` is just the right-clicked one.
   */
  readonly files: readonly TFile[];

  /**
   * Whether one file or several are selected.
   */
  readonly mode: NotebookNavigatorFileMenuSelectionMode;
}

/**
 * Whether a file menu covers one file or a multi-selection.
 */
export type NotebookNavigatorFileMenuSelectionMode = 'multiple' | 'single';

/**
 * What `menus.registerFolderMenu` hands a subscriber when a FOLDER is right-clicked.
 */
export interface NotebookNavigatorFolderMenuContext extends NotebookNavigatorMenuContext {
  /**
   * The folder that was right-clicked.
   */
  readonly folder: TFolder;
}

/**
 * What every Notebook Navigator menu context has in common: a way to add an item, and nothing else.
 *
 * The absence of a `Menu` is the whole shape of the integration problem — command handlers write into
 * a `Menu`, so something has to sit between them and this.
 */
export interface NotebookNavigatorMenuContext {
  /**
   * Adds an item to the menu Notebook Navigator is building.
   *
   * @param callback - Receives the created item, to be configured in place.
   */
  addItem(callback: (item: MenuItem) => void): void;
}

/**
 * Unregisters a menu extension. Notebook Navigator returns a bare function rather than a disposable,
 * so it is registered with the bridging component's `register`.
 */
export type NotebookNavigatorMenuDispose = () => void;

/**
 * The `menus` namespace of Notebook Navigator's API.
 *
 * Only the file and folder registrars are declared: the tag and property registrars extend menus
 * raised on things a file/folder command handler has no counterpart for.
 */
export interface NotebookNavigatorMenus {
  /**
   * Registers a contributor to the file context menu.
   *
   * @param callback - Invoked while the menu is being built.
   * @returns A function that unregisters the contributor.
   */
  registerFileMenu(callback: (context: NotebookNavigatorFileMenuContext) => void): NotebookNavigatorMenuDispose;

  /**
   * Registers a contributor to the folder context menu.
   *
   * @param callback - Invoked while the menu is being built.
   * @returns A function that unregisters the contributor.
   */
  registerFolderMenu(callback: (context: NotebookNavigatorFolderMenuContext) => void): NotebookNavigatorMenuDispose;
}

/**
 * The `source` handed to the menu event handlers for a Notebook Navigator menu.
 *
 * Obsidian's own File Explorer sends `file-explorer-context-menu`; nothing in this library gates on
 * the value, but the handlers are contracted to receive one, and a distinct string is what makes a
 * handler able to tell the two surfaces apart.
 */
export const NOTEBOOK_NAVIGATOR_MENU_SOURCE = 'notebook-navigator-context-menu';

/**
 * Notebook Navigator's plugin id, as its manifest declares it.
 */
export const NOTEBOOK_NAVIGATOR_PLUGIN_ID = 'notebook-navigator';

/**
 * Gets Notebook Navigator's API, when it is installed, enabled and new enough.
 *
 * @param app - The application instance.
 * @returns The API, or `null` when Notebook Navigator is not there to talk to.
 */
export function resolveNotebookNavigatorApi(app: App): NotebookNavigatorApi | null {
  const plugin = app.plugins.getPlugin(NOTEBOOK_NAVIGATOR_PLUGIN_ID);
  if (!plugin || !('api' in plugin)) {
    return null;
  }

  const api: unknown = plugin.api;
  return isNotebookNavigatorApi(api) ? api : null;
}

/**
 * Checks that a value is Notebook Navigator's API, by the members this library actually calls.
 *
 * A predicate rather than a cast on purpose: `api` is not part of Obsidian's `Plugin` type, so the
 * value arrives as `unknown` and the only honest way to type it is to VERIFY it. A Notebook Navigator
 * old enough to predate the menus namespace, or a future one that renames it, therefore reads as
 * "no API" and the integration stays dormant instead of throwing at menu time.
 *
 * @param value - The candidate `api` object.
 * @returns Whether it carries both menu registrars.
 */
function isNotebookNavigatorApi(value: unknown): value is NotebookNavigatorApi {
  if (typeof value !== 'object' || value === null || !('menus' in value)) {
    return false;
  }

  const menus: unknown = value.menus;
  if (typeof menus !== 'object' || menus === null) {
    return false;
  }

  return 'registerFileMenu' in menus && typeof menus.registerFileMenu === 'function'
    && 'registerFolderMenu' in menus && typeof menus.registerFolderMenu === 'function';
}
