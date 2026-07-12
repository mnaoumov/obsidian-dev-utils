// @vitest-environment jsdom

import type {
  App as AppOriginal,
  PluginManifest
} from 'obsidian';

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
import { OpenDemoVaultCommandHandler } from './desktop-open-demo-vault-command-handler.ts';

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

const app = strictProxy<AppOriginal>({});
const manifest = strictProxy<PluginManifest>({ id: 'my-plugin', name: 'My Plugin', version: '1.0.0' });
const pluginNoticeComponent = strictProxy<PluginNoticeComponent>({});

function createHandler(): OpenDemoVaultCommandHandler {
  return new OpenDemoVaultCommandHandler({
    app,
    manifest,
    pluginNoticeComponent
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
    const command = createHandler().buildCommand();
    command.checkCallback?.(false);
    await waitForAllAsyncOperations();
    expect(mockOpenDemoVault).toHaveBeenCalledWith({
      app,
      manifest,
      pluginNoticeComponent
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
