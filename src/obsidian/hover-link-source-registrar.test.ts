/**
 * @file
 *
 * Tests for {@link PluginHoverLinkSourceRegistrar}.
 */

import type {
  HoverLinkSource as HoverLinkSourceOriginal,
  Plugin as PluginOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../strict-proxy.ts';
import { PluginHoverLinkSourceRegistrar } from './hover-link-source-registrar.ts';

describe('PluginHoverLinkSourceRegistrar', () => {
  it('should delegate registerHoverLinkSource to the plugin', () => {
    const registerHoverLinkSource = vi.fn();
    const plugin = strictProxy<PluginOriginal>({ registerHoverLinkSource });
    const registrar = new PluginHoverLinkSourceRegistrar(plugin);
    const info = strictProxy<HoverLinkSourceOriginal>({
      defaultMod: false,
      display: 'My Source'
    });

    registrar.registerHoverLinkSource({
      id: 'my-source',
      info
    });

    expect(registerHoverLinkSource).toHaveBeenCalledWith('my-source', info);
  });
});
