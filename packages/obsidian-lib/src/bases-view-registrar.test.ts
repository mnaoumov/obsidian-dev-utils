/**
 * @file
 *
 * Tests for {@link PluginBasesViewRegistrar}.
 */

import type {
  BasesViewRegistration as BasesViewRegistrationOriginal,
  Plugin as PluginOriginal
} from 'obsidian';

import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginBasesViewRegistrar } from './bases-view-registrar.ts';

describe('PluginBasesViewRegistrar', () => {
  it('should delegate registerBasesView to the plugin', () => {
    const registerBasesView = vi.fn();
    const plugin = strictProxy<PluginOriginal>({ registerBasesView });
    const registrar = new PluginBasesViewRegistrar(plugin);
    const registration = strictProxy<BasesViewRegistrationOriginal>({ name: 'My View' });

    registrar.registerBasesView({
      registration,
      viewId: 'my-view'
    });

    expect(registerBasesView).toHaveBeenCalledWith('my-view', registration);
  });
});
