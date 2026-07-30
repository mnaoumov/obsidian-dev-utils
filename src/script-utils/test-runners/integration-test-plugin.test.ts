import type { LibResolver } from 'obsidian-integration-testing';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { EMPTY } from '../../string.ts';
import {
  getIntegrationTestPluginPopulate,
  OBSIDIAN_DEV_UTILS_INTEGRATION_TEST_PLUGIN_ID,
  registerIntegrationTestLibResolver
} from './integration-test-plugin.ts';

const {
  mockGetRootFolder,
  mockReadFileSync,
  mockRegisterLibResolver
} = vi.hoisted(() => ({
  mockGetRootFolder: vi.fn<(cwd?: string) => null | string>(),
  mockReadFileSync: vi.fn<(path: string) => Uint8Array>(),
  mockRegisterLibResolver: vi.fn<(resolver: LibResolver) => void>()
}));

vi.mock('node:fs', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:fs')>();
  return {
    ...mod,
    readFileSync: mockReadFileSync
  };
});

vi.mock('obsidian-integration-testing', () => ({
  registerLibResolver: mockRegisterLibResolver
}));

vi.mock('../root.ts', () => ({
  getRootFolder: mockGetRootFolder
}));

const PLUGIN_VAULT_FOLDER = `${EMPTY}.obsidian/plugins/${OBSIDIAN_DEV_UTILS_INTEGRATION_TEST_PLUGIN_ID}`;

beforeEach(() => {
  vi.resetAllMocks();
  mockGetRootFolder.mockReturnValue('/package');
  mockReadFileSync.mockImplementation((path: string) => new TextEncoder().encode(`content of ${path}`));
});

describe('getIntegrationTestPluginPopulate', () => {
  it('should map the shipped plugin binaries onto their vault paths', () => {
    const populate = getIntegrationTestPluginPopulate();

    expect(Object.keys(populate).sort()).toStrictEqual([
      `${PLUGIN_VAULT_FOLDER}/main.js`,
      `${PLUGIN_VAULT_FOLDER}/manifest.json`
    ]);
    expect(mockReadFileSync).toHaveBeenCalledWith('/package/dist/integration-test-plugin/main.js');
    expect(mockReadFileSync).toHaveBeenCalledWith('/package/dist/integration-test-plugin/manifest.json');
    expect(new TextDecoder().decode(populate[`${PLUGIN_VAULT_FOLDER}/main.js`]))
      .toBe('content of /package/dist/integration-test-plugin/main.js');
  });

  it('should throw when the obsidian-dev-utils package folder cannot be resolved', () => {
    mockGetRootFolder.mockReturnValue(null);

    expect(() => getIntegrationTestPluginPopulate())
      .toThrow('Could not resolve the obsidian-dev-utils package folder to seed the integration-test harness plugin.');
  });

  it('should throw a rebuild hint when the plugin was never built into the package', () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    expect(() => getIntegrationTestPluginPopulate())
      .toThrow('The integration-test harness plugin is missing from the installed obsidian-dev-utils package');
  });
});

describe('registerIntegrationTestLibResolver', () => {
  it('should register a resolver that returns the flat barrel the harness plugin published', () => {
    registerIntegrationTestLibResolver();

    expect(mockRegisterLibResolver).toHaveBeenCalledTimes(1);
    const resolver = mockRegisterLibResolver.mock.calls[0]?.[0];
    const merged = { someHelper: (): void => undefined };
    vi.stubGlobal('window', { __obsidianDevUtilsModule: { __merged: merged } });
    try {
      expect(resolver?.()).toBe(merged);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('should register a resolver that explains itself when the harness plugin is not loaded', () => {
    registerIntegrationTestLibResolver();

    const resolver = mockRegisterLibResolver.mock.calls[0]?.[0];
    vi.stubGlobal('window', {});
    try {
      expect(() => resolver?.()).toThrow('The obsidian-dev-utils module is not exposed on `window`.');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
