/**
 * @file
 *
 * Tests for {@link PluginObsidianProtocolHandlerRegistrar}.
 */

import type {
  ObsidianProtocolData,
  Plugin as PluginOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../strict-proxy.ts';
import { PluginObsidianProtocolHandlerRegistrar } from './obsidian-protocol-handler-registrar.ts';

describe('PluginObsidianProtocolHandlerRegistrar', () => {
  it('should delegate registerObsidianProtocolHandler to the plugin', async () => {
    const registerObsidianProtocolHandler = vi.fn<PluginOriginal['registerObsidianProtocolHandler']>();
    const plugin = strictProxy<PluginOriginal>({ registerObsidianProtocolHandler });
    const registrar = new PluginObsidianProtocolHandlerRegistrar(plugin);
    const handler = vi.fn();

    registrar.registerObsidianProtocolHandler({
      action: 'my-action',
      handler
    });

    expect(registerObsidianProtocolHandler).toHaveBeenCalledWith('my-action', expect.any(Function));

    const obsidianProtocolData = strictProxy<ObsidianProtocolData>({});
    const wrappedHandler = registerObsidianProtocolHandler.mock.calls[0]?.[1];
    await wrappedHandler?.(obsidianProtocolData);
    expect(handler).toHaveBeenCalledWith(obsidianProtocolData);
  });
});
