/**
 * @file
 *
 * Tests for {@link PluginStatusBarItemRegistrar}.
 */

import type { Plugin as PluginOriginal } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../strict-proxy.ts';
import { PluginStatusBarItemRegistrar } from './status-bar-item-registrar.ts';

describe('PluginStatusBarItemRegistrar', () => {
  it('should delegate addStatusBarItem to the plugin', () => {
    const addStatusBarItem = vi.fn();
    const plugin = strictProxy<PluginOriginal>({ addStatusBarItem });
    const registrar = new PluginStatusBarItemRegistrar(plugin);

    registrar.addStatusBarItem();

    expect(addStatusBarItem).toHaveBeenCalledWith();
  });
});
