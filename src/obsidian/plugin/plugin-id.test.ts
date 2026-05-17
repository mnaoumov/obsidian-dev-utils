/**
 * @file
 *
 * Tests for {@link getPluginId} and {@link setPluginId}.
 */

import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  getPluginId,
  NO_PLUGIN_ID_INITIALIZED,
  setPluginId
} from './plugin-id.ts';

describe('plugin-id', () => {
  beforeEach(() => {
    setPluginId(NO_PLUGIN_ID_INITIALIZED);
  });

  it('should return default value when not set', () => {
    expect(getPluginId()).toBe(NO_PLUGIN_ID_INITIALIZED);
  });

  it('should return the set plugin ID', () => {
    setPluginId('my-plugin');
    expect(getPluginId()).toBe('my-plugin');
  });

  it('should not update plugin ID when empty string is passed', () => {
    setPluginId('my-plugin');
    setPluginId('');
    expect(getPluginId()).toBe('my-plugin');
  });
});
