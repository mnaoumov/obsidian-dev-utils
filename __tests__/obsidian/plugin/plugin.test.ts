import type { Plugin } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  reloadPlugin,
  showErrorAndDisablePlugin
} from '../../../src/obsidian/plugin/plugin.ts';
import { createMockOf } from '../../test-helpers.ts';

vi.mock('../../../src/error.ts', () => ({
  printError: vi.fn()
}));

vi.mock('obsidian', () => ({
  Notice: vi.fn()
}));

describe('Plugin', () => {
  function createMockPlugin(): Plugin {
    return createMockOf<Plugin>({
      app: {
        plugins: {
          disablePlugin: vi.fn(() => Promise.resolve()),
          enablePlugin: vi.fn(() => Promise.resolve())
        }
      },
      manifest: { id: 'test-plugin' }
    });
  }

  it('should reload plugin by disabling and re-enabling', async () => {
    const plugin = createMockPlugin();
    await reloadPlugin(plugin);
    expect(plugin.app.plugins.disablePlugin).toHaveBeenCalledWith('test-plugin');
    expect(plugin.app.plugins.enablePlugin).toHaveBeenCalledWith('test-plugin');
  });

  it('should show error and disable plugin', async () => {
    const plugin = createMockPlugin();
    await showErrorAndDisablePlugin(plugin, 'Test error');
    expect(plugin.app.plugins.disablePlugin).toHaveBeenCalledWith('test-plugin');
  });
});
