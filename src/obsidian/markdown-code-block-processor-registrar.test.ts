/**
 * @file
 *
 * Tests for {@link PluginMarkdownCodeBlockProcessorRegistrar}.
 */

import type {
  MarkdownPostProcessor,
  MarkdownPostProcessorContext,
  Plugin as PluginOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noop } from '../function.ts';
import { strictProxy } from '../strict-proxy.ts';
import { PluginMarkdownCodeBlockProcessorRegistrar } from './markdown-code-block-processor-registrar.ts';

describe('PluginMarkdownCodeBlockProcessorRegistrar', () => {
  it('should delegate registerMarkdownCodeBlockProcessor to the plugin', async () => {
    const mockPostProcessor = noop;
    const registerMarkdownCodeBlockProcessor = vi.fn<PluginOriginal['registerMarkdownCodeBlockProcessor']>().mockReturnValue(mockPostProcessor as MarkdownPostProcessor);
    const plugin = strictProxy<PluginOriginal>({ registerMarkdownCodeBlockProcessor });
    const registrar = new PluginMarkdownCodeBlockProcessorRegistrar(plugin);
    const handler = vi.fn();

    const result = registrar.registerMarkdownCodeBlockProcessor({
      handler,
      language: 'dataview',
      sortOrder: 100
    });

    expect(registerMarkdownCodeBlockProcessor).toHaveBeenCalledWith('dataview', expect.any(Function), 100);
    expect(result).toBe(mockPostProcessor);

    const el = strictProxy<HTMLElement>({});
    const ctx = strictProxy<MarkdownPostProcessorContext>({});
    const wrappedHandler = registerMarkdownCodeBlockProcessor.mock.calls[0]?.[1];
    await wrappedHandler?.('source', el, ctx);
    expect(handler).toHaveBeenCalledWith('source', el, ctx);
  });
});
