import {
  afterEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  getPluginId,
  NO_PLUGIN_ID_INITIALIZED,
  setPluginId
} from '../../src/obsidian/Plugin/PluginId.ts';

describe('PluginId', () => {
  afterEach(() => {
    setPluginId(NO_PLUGIN_ID_INITIALIZED);
  });

  it('should have NO_PLUGIN_ID_INITIALIZED equal to "__no-plugin-id-initialized__"', () => {
    expect(NO_PLUGIN_ID_INITIALIZED).toBe('__no-plugin-id-initialized__');
  });

  it('should return NO_PLUGIN_ID_INITIALIZED from getPluginId initially', () => {
    expect(getPluginId()).toBe(NO_PLUGIN_ID_INITIALIZED);
  });

  it('should return the new ID after setPluginId is called', () => {
    setPluginId('my-plugin');
    expect(getPluginId()).toBe('my-plugin');
  });

  it('should not change the ID when setPluginId is called with an empty string', () => {
    setPluginId('my-plugin');
    setPluginId('');
    expect(getPluginId()).toBe('my-plugin');
  });

  it('should update the ID when setPluginId is called with a new value', () => {
    setPluginId('first-plugin');
    setPluginId('second-plugin');
    expect(getPluginId()).toBe('second-plugin');
  });
});
