/**
 * @file
 *
 * Tests for {@link PluginRibbonIconRegistrar}.
 */

import type { Plugin as PluginOriginal } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../strict-proxy.ts';
import { PluginRibbonIconRegistrar } from './ribbon-icon-registrar.ts';

describe('PluginRibbonIconRegistrar', () => {
  it('should delegate addRibbonIcon to the plugin and return the element', () => {
    const element = createDiv();
    const addRibbonIcon = vi.fn().mockReturnValue(element);
    const plugin = strictProxy<PluginOriginal>({ addRibbonIcon });
    const registrar = new PluginRibbonIconRegistrar(plugin);
    const callback = vi.fn();

    const result = registrar.addRibbonIcon({
      callback,
      icon: 'dice',
      title: 'My Icon'
    });

    expect(addRibbonIcon).toHaveBeenCalledWith('dice', 'My Icon', callback);
    expect(result).toBe(element);
  });
});
