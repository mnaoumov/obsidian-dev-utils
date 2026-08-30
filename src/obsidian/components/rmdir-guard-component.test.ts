import type { App as AppOriginal } from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { assertNonNullable } from '../../type-guards.ts';
import {
  NOT_EMPTY_DIRECTORY_ERROR_CODE,
  RmdirGuardComponent
} from './rmdir-guard-component.ts';

// Every order in which three independently loaded guards can be unloaded.
const UNLOAD_ORDERS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0]
];

const EMPTY_FOLDER_PATH = 'empty-folder';
const FILE_PATH = 'file.md';
const MISSING_PATH = 'missing-folder';
const NON_EMPTY_FOLDER_PATH = 'non-empty-folder';
const NON_EMPTY_FOLDER_CHILD_PATH = `${NON_EMPTY_FOLDER_PATH}/child.md`;

let app: AppOriginal;
let component: RmdirGuardComponent;

beforeEach(async () => {
  app = App.createConfigured__().asOriginalType__();
  await app.vault.adapter.mkdir(EMPTY_FOLDER_PATH);
  await app.vault.adapter.mkdir(NON_EMPTY_FOLDER_PATH);
  await app.vault.adapter.write(NON_EMPTY_FOLDER_CHILD_PATH, 'CHILD');
  await app.vault.adapter.write(FILE_PATH, 'FILE');
  component = new RmdirGuardComponent(app);
  component.load();
});

afterEach(() => {
  component.unload();
});

describe('RmdirGuardComponent', () => {
  it('should refuse a non-recursive removal of a folder that has children', async () => {
    await expect(app.vault.adapter.rmdir(NON_EMPTY_FOLDER_PATH, false)).rejects.toMatchObject({
      code: NOT_EMPTY_DIRECTORY_ERROR_CODE,
      message: `Directory ${NON_EMPTY_FOLDER_PATH} is not empty`,
      path: NON_EMPTY_FOLDER_PATH
    });

    expect(await app.vault.adapter.exists(NON_EMPTY_FOLDER_PATH)).toBe(true);
    expect(await app.vault.adapter.exists(NON_EMPTY_FOLDER_CHILD_PATH)).toBe(true);
  });

  it('should remove a folder that has no children non-recursively', async () => {
    await app.vault.adapter.rmdir(EMPTY_FOLDER_PATH, false);
    expect(await app.vault.adapter.exists(EMPTY_FOLDER_PATH)).toBe(false);
  });

  it('should leave a recursive removal untouched', async () => {
    await app.vault.adapter.rmdir(NON_EMPTY_FOLDER_PATH, true);
    expect(await app.vault.adapter.exists(NON_EMPTY_FOLDER_PATH)).toBe(false);
    expect(await app.vault.adapter.exists(NON_EMPTY_FOLDER_CHILD_PATH)).toBe(false);
  });

  it('should not check emptiness when the target is a file', async () => {
    const listSpy = vi.spyOn(app.vault.adapter, 'list');

    await app.vault.adapter.rmdir(FILE_PATH, false);

    expect(listSpy).not.toHaveBeenCalled();
    expect(await app.vault.adapter.exists(FILE_PATH)).toBe(true);
  });

  it('should not check emptiness when the target does not exist', async () => {
    const listSpy = vi.spyOn(app.vault.adapter, 'list');

    await app.vault.adapter.rmdir(MISSING_PATH, false);

    expect(listSpy).not.toHaveBeenCalled();
  });

  it('should stop guarding once unloaded', async () => {
    component.unload();

    await app.vault.adapter.rmdir(NON_EMPTY_FOLDER_PATH, false);

    expect(await app.vault.adapter.exists(NON_EMPTY_FOLDER_PATH)).toBe(false);
  });

  /*
   * Several plugins loading the guard is the normal case, not an edge case: each bundles its own copy of
   * this library and they all patch the one shared adapter. These cases pin the invariant that makes the
   * guard safe to stack without a patch token -- `monkey-around` neutralizes an unloaded wrapper in place
   * rather than splicing it out of the chain, so the method stays guarded until the LAST guard unloads, in
   * whatever order they go.
   */
  it.each(UNLOAD_ORDERS.map((unloadOrder) => ({
    title: unloadOrder.join(''),
    unloadOrder
  })))('should stay guarded until the last of three guards unloads, unload order $title', async ({ unloadOrder }) => {
    // The guard installed by `beforeEach` would be a fourth layer; this case owns the whole chain.
    component.unload();
    const guards = [0, 1, 2].map(() => {
      const guard = new RmdirGuardComponent(app);
      guard.load();
      return guard;
    });

    const orderedGuards = unloadOrder.map((guardIndex) => {
      const guard = guards[guardIndex];
      assertNonNullable(guard);
      return guard;
    });

    try {
      await expectGuarded();

      for (const [position, guard] of orderedGuards.entries()) {
        guard.unload();
        if (position === orderedGuards.length - 1) {
          await expectUnguarded();
        } else {
          await expectGuarded();
        }
      }
    } finally {
      for (const guard of guards) {
        guard.unload();
      }
    }
  });

  async function expectGuarded(): Promise<void> {
    await expect(app.vault.adapter.rmdir(NON_EMPTY_FOLDER_PATH, false)).rejects.toMatchObject({
      code: NOT_EMPTY_DIRECTORY_ERROR_CODE
    });
    expect(await app.vault.adapter.exists(NON_EMPTY_FOLDER_PATH)).toBe(true);
    expect(await app.vault.adapter.exists(NON_EMPTY_FOLDER_CHILD_PATH)).toBe(true);
  }

  async function expectUnguarded(): Promise<void> {
    await app.vault.adapter.rmdir(NON_EMPTY_FOLDER_PATH, false);
    expect(await app.vault.adapter.exists(NON_EMPTY_FOLDER_PATH)).toBe(false);
  }
});
