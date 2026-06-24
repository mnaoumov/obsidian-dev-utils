/**
 * @file
 *
 * Tests for {@link PluginMarkdownPostProcessorRegistrar}.
 */

import type {
  MarkdownPostProcessorContext as MarkdownPostProcessorContextOriginal,
  Plugin as PluginOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../strict-proxy.ts';
import { PluginMarkdownPostProcessorRegistrar } from './markdown-post-processor-registrar.ts';

describe('PluginMarkdownPostProcessorRegistrar', () => {
  it('should delegate registerMarkdownPostProcessor to the plugin', () => {
    const registerMarkdownPostProcessor = vi.fn();
    const plugin = strictProxy<PluginOriginal>({ registerMarkdownPostProcessor });
    const registrar = new PluginMarkdownPostProcessorRegistrar(plugin);
    const postProcessor = vi.fn();

    registrar.registerMarkdownPostProcessor({
      postProcessor,
      sortOrder: 5
    });

    expect(registerMarkdownPostProcessor).toHaveBeenCalledWith(expect.any(Function), 5);
  });

  it('should wrap the post processor so it forwards the element and context', async () => {
    const registerMarkdownPostProcessor = vi.fn<PluginOriginal['registerMarkdownPostProcessor']>();
    const plugin = strictProxy<PluginOriginal>({ registerMarkdownPostProcessor });
    const registrar = new PluginMarkdownPostProcessorRegistrar(plugin);
    const postProcessor = vi.fn();

    registrar.registerMarkdownPostProcessor({ postProcessor });

    const wrapped = registerMarkdownPostProcessor.mock.calls[0]?.[0];
    const el = createDiv();
    const ctx = strictProxy<MarkdownPostProcessorContextOriginal>({ docId: 'doc-1' });
    await wrapped?.(el, ctx);

    expect(postProcessor).toHaveBeenCalledWith(el, ctx);
  });
});
