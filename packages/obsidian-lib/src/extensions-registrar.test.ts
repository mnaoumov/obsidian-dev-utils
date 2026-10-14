/**
 * @file
 *
 * Tests for {@link PluginExtensionsRegistrar}.
 */

import type { Plugin as PluginOriginal } from 'obsidian';

import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginExtensionsRegistrar } from './extensions-registrar.ts';

describe('PluginExtensionsRegistrar', () => {
  it('should delegate registerExtensions to the plugin', () => {
    const registerExtensions = vi.fn();
    const plugin = strictProxy<PluginOriginal>({ registerExtensions });
    const registrar = new PluginExtensionsRegistrar(plugin);

    registrar.registerExtensions({
      extensions: ['foo', 'bar'],
      viewType: 'my-view'
    });

    expect(registerExtensions).toHaveBeenCalledWith(['foo', 'bar'], 'my-view');
  });
});
