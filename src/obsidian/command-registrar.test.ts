/**
 * @file
 *
 * Tests for {@link PluginCommandRegistrar}.
 */

import type {
  Command as CommandOriginal,
  Plugin as PluginOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../test-helpers/mock-implementation.ts';
import { PluginCommandRegistrar } from './command-registrar.ts';

describe('PluginCommandRegistrar', () => {
  it('should delegate addCommand to the plugin', () => {
    const addCommand = vi.fn();
    const plugin = strictProxy<PluginOriginal>({ addCommand });
    const registrar = new PluginCommandRegistrar(plugin);
    const command = strictProxy<CommandOriginal>({
      id: 'test-command',
      name: 'Test Command'
    });

    registrar.addCommand(command);

    expect(addCommand).toHaveBeenCalledWith(command);
  });
});
