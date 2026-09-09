/**
 * @file
 *
 * Tests for the plugin lifecycle broadcast.
 */

import type { App as AppOriginal } from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginLifecycleEventPayload } from './plugin-lifecycle-events.ts';

import {
  PLUGIN_LOADED_EVENT_NAME,
  PLUGIN_UNLOADED_EVENT_NAME,
  triggerPluginLifecycleEvent
} from './plugin-lifecycle-events.ts';

const PAYLOAD: PluginLifecycleEventPayload = {
  apiVersions: ['1.0.0'],
  dependencyPluginIds: ['required-plugin'],
  pluginId: 'host-plugin',
  pluginName: 'Host Plugin',
  pluginVersion: '2.3.4'
};

let app: AppOriginal;

beforeEach(() => {
  app = App.createConfigured__().asOriginalType__();
});

describe('event names', () => {
  it('should namespace on the package name, so a plugin author who does not use this library can recognize them', () => {
    expect(PLUGIN_LOADED_EVENT_NAME).toBe('obsidian-dev-utils:plugin-loaded');
    expect(PLUGIN_UNLOADED_EVENT_NAME).toBe('obsidian-dev-utils:plugin-unloaded');
  });
});

describe('triggerPluginLifecycleEvent', () => {
  it('should deliver the loaded payload to a workspace subscriber', () => {
    const callback = vi.fn<(payload: PluginLifecycleEventPayload) => void>();
    app.workspace.on(PLUGIN_LOADED_EVENT_NAME, callback);

    triggerPluginLifecycleEvent({
      app,
      name: PLUGIN_LOADED_EVENT_NAME,
      payload: PAYLOAD
    });

    expect(callback).toHaveBeenCalledWith(PAYLOAD);
  });

  it('should deliver the unloaded payload to a workspace subscriber', () => {
    const callback = vi.fn<(payload: PluginLifecycleEventPayload) => void>();
    app.workspace.on(PLUGIN_UNLOADED_EVENT_NAME, callback);

    triggerPluginLifecycleEvent({
      app,
      name: PLUGIN_UNLOADED_EVENT_NAME,
      payload: PAYLOAD
    });

    expect(callback).toHaveBeenCalledWith(PAYLOAD);
  });

  it('should keep the two events apart, so a listener for one never hears the other', () => {
    const loadedCallback = vi.fn<(payload: PluginLifecycleEventPayload) => void>();
    app.workspace.on(PLUGIN_LOADED_EVENT_NAME, loadedCallback);

    triggerPluginLifecycleEvent({
      app,
      name: PLUGIN_UNLOADED_EVENT_NAME,
      payload: PAYLOAD
    });

    expect(loadedCallback).not.toHaveBeenCalled();
  });
});
