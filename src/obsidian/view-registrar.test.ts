/**
 * @file
 *
 * Tests for {@link PluginViewRegistrar}.
 */

import type {
  Plugin as PluginOriginal,
  ViewCreator as ViewCreatorOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../strict-proxy.ts';
import { PluginViewRegistrar } from './view-registrar.ts';

describe('PluginViewRegistrar', () => {
  it('should delegate registerView to the plugin', () => {
    const registerView = vi.fn();
    const plugin = strictProxy<PluginOriginal>({ registerView });
    const registrar = new PluginViewRegistrar(plugin);
    const viewCreator: ViewCreatorOriginal = vi.fn();

    registrar.registerView('test-view', viewCreator);

    expect(registerView).toHaveBeenCalledWith('test-view', viewCreator);
  });
});
