import type { Plugin } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from '../object-utils.ts';
import { PluginDataHandler } from './data-handler.ts';

describe('PluginDataHandler', () => {
  it('should delegate loadData to plugin', async () => {
    const mockData = { foo: 'bar' };
    const plugin = castTo<Plugin>({
      loadData: vi.fn().mockResolvedValue(mockData),
      saveData: vi.fn()
    });

    const handler = new PluginDataHandler(plugin);
    const result = await handler.loadData();

    expect(plugin.loadData).toHaveBeenCalled();
    expect(result).toBe(mockData);
  });

  it('should delegate saveData to plugin', async () => {
    const plugin = castTo<Plugin>({
      loadData: vi.fn(),
      saveData: vi.fn().mockResolvedValue(undefined)
    });

    const handler = new PluginDataHandler(plugin);
    const data = { count: 42 };
    await handler.saveData(data);

    expect(plugin.saveData).toHaveBeenCalledWith(data);
  });
});
