import type { Plugin } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { createMockOf } from '../../test-helpers.ts';
import {
  reloadPlugin,
  showErrorAndDisablePlugin
} from './plugin.ts';

vi.mock('../../error.ts', () => ({
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
