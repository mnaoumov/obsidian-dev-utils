// @vitest-environment jsdom

import type { App as AppOriginal } from 'obsidian';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginNoticeComponent } from '../components/plugin-notice-component.ts';

import { waitForAllAsyncOperations } from '../../async.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { OpenDemoVaultCommandHandler } from './open-demo-vault-command-handler.ts';

const { mockOpenDemoVault, platformState } = vi.hoisted(() => ({
  mockOpenDemoVault: vi.fn(),
  platformState: { isDesktopApp: true }
}));

vi.mock('obsidian', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian')>();
  return {
    ...actual,
    Platform: {
      ...actual.Platform,
      get isDesktopApp(): boolean {
        return platformState.isDesktopApp;
      }
    }
  };
});

vi.mock('../desktop-demo-vault-opener.ts', () => ({
  openDemoVault: mockOpenDemoVault
}));

const PLUGIN_ID = 'my-plugin';
const PLUGIN_NAME = 'My Plugin';
const PLUGIN_VERSION = '1.0.0';
const app = strictProxy<AppOriginal>({});
const pluginNoticeComponent = strictProxy<PluginNoticeComponent>({});

function createHandler(): OpenDemoVaultCommandHandler {
  return new OpenDemoVaultCommandHandler({
    app,
    pluginId: PLUGIN_ID,
    pluginNoticeComponent,
    pluginVersion: PLUGIN_VERSION
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  platformState.isDesktopApp = true;
  mockOpenDemoVault.mockResolvedValue(undefined);
});

describe('OpenDemoVaultCommandHandler', () => {
  it('should build a command with the expected id, name, and icon', () => {
    const command = createHandler().buildCommand();
    expect(command.id).toBe('open-demo-vault');
    expect(command.name).toBe('Open demo vault');
    expect(command.icon).toBe('download');
  });

  it('should be available on desktop', () => {
    platformState.isDesktopApp = true;
    const command = createHandler().buildCommand();
    expect(command.checkCallback?.(true)).toBe(true);
  });

  it('should be unavailable on mobile', () => {
    platformState.isDesktopApp = false;
    const command = createHandler().buildCommand();
    expect(command.checkCallback?.(true)).toBe(false);
  });

  it('should open the demo vault when invoked on desktop', async () => {
    const handler = createHandler();
    // The plugin name flows from registration (the base handler), not the constructor.
    await handler.onRegistered({
      activeFileProvider: { getActiveFile: () => null },
      menuEventRegistrar: {
        registerEditorMenuEventHandler: vi.fn(),
        registerFileMenuEventHandler: vi.fn(),
        registerFilesMenuEventHandler: vi.fn()
      },
      pluginName: PLUGIN_NAME
    });
    const command = handler.buildCommand();
    command.checkCallback?.(false);
    await waitForAllAsyncOperations();
    expect(mockOpenDemoVault).toHaveBeenCalledWith({
      app,
      pluginId: PLUGIN_ID,
      pluginName: PLUGIN_NAME,
      pluginNoticeComponent,
      pluginVersion: PLUGIN_VERSION
    });
  });

  it('should not open the demo vault when invoked on mobile', async () => {
    platformState.isDesktopApp = false;
    const command = createHandler().buildCommand();
    command.checkCallback?.(false);
    await waitForAllAsyncOperations();
    expect(mockOpenDemoVault).not.toHaveBeenCalled();
  });
});
