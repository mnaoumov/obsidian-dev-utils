import type { App as AppOriginal } from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginContextComponent } from './plugin-context-component.ts';

const mocks = vi.hoisted(() => ({
  initDebugController: vi.fn(),
  initPluginContext: vi.fn(),
  registerAllWindowsHandler: vi.fn()
}));

vi.mock('../../components/all-windows-event-handler.ts', () => {
  class MockAllWindowsEventHandler {
    public registerAllWindowsHandler(handler: (win: Window) => void): void {
      mocks.registerAllWindowsHandler(handler);

      handler(window);
    }
  }
  return { AllWindowsEventHandler: MockAllWindowsEventHandler };
});

vi.mock('../plugin-context.ts', () => ({
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
    expect(mocks.initPluginContext).toHaveBeenCalledWith(app, 'test-plugin');
  });

  it('should register debug controller for all windows', () => {
    const component = new PluginContextComponent({ app, pluginId: 'test-plugin' });
    component.onload();

    expect(mocks.initDebugController).toHaveBeenCalledWith(window, component);
  });
});
