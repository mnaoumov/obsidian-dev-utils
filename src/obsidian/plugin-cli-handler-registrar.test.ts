/**
 * @file
 *
 * Tests for {@link PluginCliHandlerRegistrar}.
 */

import type {
  CliData as CliDataOriginal,
  CliFlags as CliFlagsOriginal,
  Plugin as PluginOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../strict-proxy.ts';
import { PluginCliHandlerRegistrar } from './plugin-cli-handler-registrar.ts';

describe('PluginCliHandlerRegistrar', () => {
  it('should delegate registerCliHandler to the plugin', () => {
    const registerCliHandler = vi.fn();
    const plugin = strictProxy<PluginOriginal>({ registerCliHandler });
    const registrar = new PluginCliHandlerRegistrar(plugin);
    const flags = strictProxy<CliFlagsOriginal>({});
    const handler = vi.fn();

    registrar.registerCliHandler({
      command: 'my-command',
      description: 'My command',
      flags,
      handler
    });

    expect(registerCliHandler).toHaveBeenCalledWith('my-command', 'My command', flags, expect.any(Function));
  });

  it('should wrap the handler so it forwards the CLI data and returns the result', () => {
    const registerCliHandler = vi.fn<PluginOriginal['registerCliHandler']>();
    const plugin = strictProxy<PluginOriginal>({ registerCliHandler });
    const registrar = new PluginCliHandlerRegistrar(plugin);
    const handler = vi.fn().mockReturnValue('done');

    registrar.registerCliHandler({
      command: 'my-command',
      description: 'My command',
      flags: null,
      handler
    });

    const wrapped = registerCliHandler.mock.calls[0]?.[3];
    const cliData = strictProxy<CliDataOriginal>({});
    const result = wrapped?.(cliData);

    expect(handler).toHaveBeenCalledWith(cliData);
    expect(result).toBe('done');
  });
});
