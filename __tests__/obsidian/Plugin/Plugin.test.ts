import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  reloadPlugin,
  showErrorAndDisablePlugin
} from '../../../src/obsidian/Plugin/Plugin.ts';

vi.mock('../../../src/Error.ts', () => ({
  printError: vi.fn()
}));

vi.mock('obsidian', () => ({
  Notice: vi.fn()
}));

describe('Plugin', () => {
  function createMockPlugin(): {
    app: { plugins: { disablePlugin: ReturnType<typeof vi.fn>; enablePlugin: ReturnType<typeof vi.fn> } };
    manifest: { id: string };
  } {
    return {
      app: {
        plugins: {
          disablePlugin: vi.fn(() => Promise.resolve()),
          enablePlugin: vi.fn(() => Promise.resolve())
        }
      },
      manifest: { id: 'test-plugin' }
    };
  }

  it('should reload plugin by disabling and re-enabling', async () => {
    const plugin = createMockPlugin();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- Mock doesn't implement full Plugin type
    await reloadPlugin(plugin as any);
    expect(plugin.app.plugins.disablePlugin).toHaveBeenCalledWith('test-plugin');
    expect(plugin.app.plugins.enablePlugin).toHaveBeenCalledWith('test-plugin');
  });

  it('should show error and disable plugin', async () => {
    const plugin = createMockPlugin();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- Mock doesn't implement full Plugin type
    await showErrorAndDisablePlugin(plugin as any, 'Test error');
    expect(plugin.app.plugins.disablePlugin).toHaveBeenCalledWith('test-plugin');
  });
});
