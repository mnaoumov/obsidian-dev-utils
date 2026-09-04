/**
 * @file
 *
 * Tests for {@link resolveNotebookNavigatorApi}.
 */

import type {
  App as AppOriginal,
  Plugin as PluginOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it
} from 'vitest';

import { castTo } from '../object-utils.ts';
import { strictProxy } from '../strict-proxy.ts';
import {
  NOTEBOOK_NAVIGATOR_PLUGIN_ID,
  resolveNotebookNavigatorApi
} from './notebook-navigator.ts';

/**
 * A minimal API object that passes every check the guard makes.
 */
const VALID_API = {
  menus: {
    registerFileMenu: (): () => void => (): void => undefined,
    registerFolderMenu: (): () => void => (): void => undefined
  }
};

/**
 * Builds an app whose plugin registry holds the given Notebook Navigator.
 *
 * Not a candidate for `obsidian-test-mocks`' `registerPlugin__`: this builds a standalone fake rather than
 * stubbing around `App.createConfigured__()`'s strict proxy, so there is no real registry here to seed. The
 * function under test takes any app shape, and giving it a whole configured vault to reach one `getPlugin`
 * would widen what the test isolates rather than narrow it.
 *
 * @param notebookNavigator - What `getPlugin('notebook-navigator')` returns.
 * @returns The app.
 */
function createApp(notebookNavigator: unknown): AppOriginal {
  return strictProxy<AppOriginal>({
    plugins: {
      // The registry is typed to return a `Plugin`; every shape under test is deliberately NOT one,
      // Which is the whole point — the guard has to survive whatever another plugin actually exposes.
      getPlugin: (id: string): null | PluginOriginal => id === NOTEBOOK_NAVIGATOR_PLUGIN_ID ? castTo<null | PluginOriginal>(notebookNavigator) : null
    }
  });
}

describe('resolveNotebookNavigatorApi', () => {
  it('should return the API of an installed Notebook Navigator', () => {
    expect(resolveNotebookNavigatorApi(createApp({ api: VALID_API }))).toBe(VALID_API);
  });

  it('should return null when Notebook Navigator is not installed', () => {
    expect(resolveNotebookNavigatorApi(createApp(null))).toBeNull();
  });

  it('should return null when the plugin exposes no API at all', () => {
    expect(resolveNotebookNavigatorApi(createApp({}))).toBeNull();
  });

  /*
   * Every shape below is a Notebook Navigator too old, too new or too broken to talk to. Each has to
   * read as "no API" rather than throw, because the alternative is an exception raised while the
   * user's context menu is opening.
   */
  it.each([
    ['a non-object API', 'not an api'],
    ['a null API', null],
    ['an API with no menus namespace', {}],
    ['an API whose menus is not an object', { menus: 'nope' }],
    ['an API whose menus is null', { menus: null }],
    ['menus with no registerFileMenu', { menus: { registerFolderMenu: (): void => undefined } }],
    ['menus whose registerFileMenu is not callable', {
      menus: { registerFileMenu: 'nope', registerFolderMenu: (): void => undefined }
    }],
    ['menus with no registerFolderMenu', { menus: { registerFileMenu: (): void => undefined } }],
    ['menus whose registerFolderMenu is not callable', {
      menus: { registerFileMenu: (): void => undefined, registerFolderMenu: 'nope' }
    }]
  ])('should return null for %s', (_description: string, api: unknown) => {
    expect(resolveNotebookNavigatorApi(createApp({ api }))).toBeNull();
  });
});
