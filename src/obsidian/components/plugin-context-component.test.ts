import type { App as AppOriginal } from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { Library } from '../../library.ts';
import { assertNonNullable } from '../../type-guards.ts';
import { PluginContextComponent } from './plugin-context-component.ts';

const mocks = vi.hoisted(() => ({
  initDebugController: vi.fn(),
  initPluginContext: vi.fn(),
  registerAllWindowsHandler: vi.fn()
}));

vi.mock('./all-windows-event-component.ts', () => {
  class MockAllWindowsEventComponent {
    public registerAllWindowsHandler(handler: (win: Window) => void): void {
      mocks.registerAllWindowsHandler(handler);

      handler(window);
    }
  }
  return { AllWindowsEventComponent: MockAllWindowsEventComponent };
});

vi.mock('../plugin/plugin-context.ts', () => ({
  initDebugController: mocks.initDebugController,
  initPluginContext: mocks.initPluginContext
}));

let app: AppOriginal;

beforeEach(() => {
  vi.clearAllMocks();
  app = App.createConfigured__().asOriginalType__();
});

describe('PluginContextComponent', () => {
  it('should initialize plugin context on load', () => {
    const component = new PluginContextComponent({ app, pluginId: 'test-plugin' });
    component.onload();
    expect(mocks.initPluginContext).toHaveBeenCalledWith('test-plugin');
  });

  it('should register debug controller for all windows', () => {
    const component = new PluginContextComponent({ app, pluginId: 'test-plugin' });
    component.onload();

    expect(mocks.initDebugController).toHaveBeenCalledWith(window, component);
  });

  it('should reset the Library on unload so a reload can re-initialize', () => {
    Library.init({ cssClassScope: 'test-plugin', debugPrefixNamespace: 'test-plugin:', shouldPrintStackTrace: true });
    const component = new PluginContextComponent({ app, pluginId: 'test-plugin' });
    const registerSpy = vi.spyOn(component, 'register');
    component.onload();

    // `initDebugController` is mocked, so the only registered cleanup is the Library reset.
    const cleanup = registerSpy.mock.calls[0]?.[0];
    assertNonNullable(cleanup);
    cleanup();

    expect(Library.cssClassScope).toBe('');
  });
});
