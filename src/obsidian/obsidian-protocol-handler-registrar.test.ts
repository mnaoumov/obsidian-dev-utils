/**
 * @file
 *
 * Tests for {@link PluginObsidianProtocolHandlerRegistrar}.
 */

import type { Plugin as PluginOriginal } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../strict-proxy.ts';
import { PluginObsidianProtocolHandlerRegistrar } from './obsidian-protocol-handler-registrar.ts';

describe('PluginObsidianProtocolHandlerRegistrar', () => {
  it('should delegate registerObsidianProtocolHandler to the plugin', () => {
    const registerObsidianProtocolHandler = vi.fn();
    const plugin = strictProxy<PluginOriginal>({ registerObsidianProtocolHandler });
    const registrar = new PluginObsidianProtocolHandlerRegistrar(plugin);
    const handler = vi.fn();

    registrar.registerObsidianProtocolHandler('my-action', handler);

    expect(registerObsidianProtocolHandler).toHaveBeenCalledWith('my-action', handler);
  });
});
