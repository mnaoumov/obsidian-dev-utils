import type { App } from 'obsidian';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noopAsync } from '../function.ts';
import { strictProxy } from '../strict-proxy.ts';
import { bootstrapDemoVault } from './demo-vault-helper.ts';

const {
  mockConfigure,
  mockEnable,
  mockInstall
} = vi.hoisted(() => ({
  mockConfigure: vi.fn(),
  mockEnable: vi.fn(),
  mockInstall: vi.fn()
}));

vi.mock('./community-plugins.ts', () => ({
  configureCommunityPlugin: mockConfigure,
  enableCommunityPlugin: mockEnable,
  installCommunityPlugin: mockInstall
}));

const CODE_SCRIPT_TOOLKIT_PLUGIN_ID = 'fix-require-modules';

// An identity handle passed straight through to the mocked collaborators (never read), so the strict proxy never throws.
const app = strictProxy<App>({});

beforeEach(() => {
  vi.clearAllMocks();
  mockInstall.mockResolvedValue(undefined);
  mockConfigure.mockResolvedValue(undefined);
  mockEnable.mockResolvedValue(undefined);
});

describe('bootstrapDemoVault', () => {
  it('should install and enable CodeScript Toolkit', async () => {
    await bootstrapDemoVault({ app });
    expect(mockInstall).toHaveBeenCalledWith({ app, pluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID });
    expect(mockEnable).toHaveBeenCalledWith({ app, pluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID });
  });

  it('should configure CodeScript Toolkit with modulesRoot and startupScriptPath', async () => {
    await bootstrapDemoVault({ app });
    expect(mockConfigure).toHaveBeenCalledWith({
      app,
      pluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID,
      settings: {
        invocableScriptsFolder: 'Invocables',
        modulesRoot: '_assets/CodeScriptToolkit',
        shouldHandleProtocolUrls: true,
        startupScriptPath: 'startup.ts'
      }
    });
  });

  it('should configure before enabling so the plugin loads configured with no reload', async () => {
    const callOrder: string[] = [];
    mockInstall.mockImplementation(() => {
      callOrder.push('install');
      return noopAsync();
    });
    mockConfigure.mockImplementation(() => {
      callOrder.push('configure');
      return noopAsync();
    });
    mockEnable.mockImplementation(() => {
      callOrder.push('enable');
      return noopAsync();
    });
    await bootstrapDemoVault({ app });
    expect(callOrder).toStrictEqual(['install', 'configure', 'enable']);
  });
});
