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

import {
  NOT_EMPTY_DIRECTORY_ERROR_CODE,
  RmdirGuardComponent
} from './rmdir-guard-component.ts';

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
});
