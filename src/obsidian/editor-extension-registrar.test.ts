/**
 * @file
 *
 * Tests for {@link PluginEditorExtensionRegistrar}.
 */

import type { Extension } from '@codemirror/state';
import type { Plugin as PluginOriginal } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../strict-proxy.ts';
import { PluginEditorExtensionRegistrar } from './editor-extension-registrar.ts';

describe('PluginEditorExtensionRegistrar', () => {
  it('should delegate registerEditorExtension to the plugin', () => {
    const registerEditorExtension = vi.fn();
    const plugin = strictProxy<PluginOriginal>({ registerEditorExtension });
    const registrar = new PluginEditorExtensionRegistrar(plugin);
    const extension: Extension = [];

    registrar.registerEditorExtension(extension);

    expect(registerEditorExtension).toHaveBeenCalledWith(extension);
  });
});
