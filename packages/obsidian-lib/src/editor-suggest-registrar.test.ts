/**
 * @file
 *
 * Tests for {@link PluginEditorSuggestRegistrar}.
 */

import type {
  EditorSuggest as EditorSuggestOriginal,
  Plugin as PluginOriginal
} from 'obsidian';

import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginEditorSuggestRegistrar } from './editor-suggest-registrar.ts';

describe('PluginEditorSuggestRegistrar', () => {
  it('should delegate registerEditorSuggest to the plugin', () => {
    const registerEditorSuggest = vi.fn();
    const plugin = strictProxy<PluginOriginal>({ registerEditorSuggest });
    const registrar = new PluginEditorSuggestRegistrar(plugin);
    const editorSuggest = strictProxy<EditorSuggestOriginal<unknown>>({});

    registrar.registerEditorSuggest(editorSuggest);

    expect(registerEditorSuggest).toHaveBeenCalledWith(editorSuggest);
  });
});
