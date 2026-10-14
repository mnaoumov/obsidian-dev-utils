/**
 * @file
 *
 * Tests for {@link PluginStatusBarItemRegistrar}.
 */

import type { Plugin as PluginOriginal } from 'obsidian';

import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginStatusBarItemRegistrar } from './status-bar-item-registrar.ts';

describe('PluginStatusBarItemRegistrar', () => {
  it('should delegate addStatusBarItem to the plugin and return its element', () => {
    const statusBarItemEl = strictProxy<HTMLElement>({});
    const addStatusBarItem = vi.fn(() => statusBarItemEl);
    const plugin = strictProxy<PluginOriginal>({ addStatusBarItem });
    const registrar = new PluginStatusBarItemRegistrar(plugin);

    const result = registrar.addStatusBarItem();

    expect(addStatusBarItem).toHaveBeenCalledWith();
    expect(result).toBe(statusBarItemEl);
  });
});
