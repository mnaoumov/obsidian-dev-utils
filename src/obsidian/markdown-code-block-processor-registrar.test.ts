/**
 * @file
 *
 * Tests for {@link PluginMarkdownCodeBlockProcessorRegistrar}.
 */

import type { Plugin as PluginOriginal } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noop } from '../function.ts';
import { strictProxy } from '../test-helpers/mock-implementation.ts';
import { PluginMarkdownCodeBlockProcessorRegistrar } from './markdown-code-block-processor-registrar.ts';

describe('PluginMarkdownCodeBlockProcessorRegistrar', () => {
  it('should delegate registerMarkdownCodeBlockProcessor to the plugin', () => {
    const mockPostProcessor = noop;
    const registerMarkdownCodeBlockProcessor = vi.fn().mockReturnValue(mockPostProcessor);
    const plugin = strictProxy<PluginOriginal>({ registerMarkdownCodeBlockProcessor });
    const registrar = new PluginMarkdownCodeBlockProcessorRegistrar(plugin);
    const handler = vi.fn();

    const result = registrar.registerMarkdownCodeBlockProcessor('dataview', handler, 100);

    expect(registerMarkdownCodeBlockProcessor).toHaveBeenCalledWith('dataview', handler, 100);
    expect(result).toBe(mockPostProcessor);
  });
});
