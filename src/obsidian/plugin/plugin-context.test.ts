import type {
  App as AppOriginal,
  Component
} from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../../test-helpers/mock-implementation.ts';
import { ensureGenericObject } from '../../type-guards.ts';
import {
  addPluginCssClasses,
  initDebugController,
  initPluginContext
} from './plugin-context.ts';

let app: AppOriginal;

beforeEach(() => {
  app = App.createConfigured__().asOriginalType__();
});

const mocks = vi.hoisted(() => ({
  compareVersions: vi.fn((_a: string, _b: string) => 1),
  getDebugController: vi.fn(() => ({})),
  getObsidianDevUtilsState: vi.fn(() => ({ value: '0.0.0' })),
  getPluginId: vi.fn(() => 'test-plugin'),
  setPluginId: vi.fn(),
  showInitialDebugMessage: vi.fn()
}));

vi.mock('compare-versions', () => ({
  compareVersions: mocks.compareVersions
}));

vi.mock('../../debug-controller.ts', () => ({}));

vi.mock('../../css-class.ts', () => ({
  CssClass: { LibraryName: 'obsidian-dev-utils' }
}));

vi.mock('../../debug.ts', () => ({
  getDebugController: mocks.getDebugController,
  showInitialDebugMessage: mocks.showInitialDebugMessage
}));

vi.mock('../../library.ts', () => ({
  LIBRARY_NAME: 'obsidian-dev-utils',
  LIBRARY_STYLES: '.test { color: red; }',
  LIBRARY_VERSION: '1.0.0'
}));

vi.mock('../../obsidian/app.ts', () => ({
  getObsidianDevUtilsState: mocks.getObsidianDevUtilsState
}));

vi.mock('../../obsidian/plugin/plugin-id.ts', () => ({
  getPluginId: mocks.getPluginId,
  setPluginId: mocks.setPluginId
}));

describe('addPluginCssClasses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add library name, plugin id, and custom css classes', () => {
    const addClass = vi.fn();
    const el = strictProxy<HTMLElement>({ addClass });
    addPluginCssClasses(el, 'custom-class');
    expect(addClass).toHaveBeenCalledWith('obsidian-dev-utils', 'test-plugin', 'custom-class');
  });
});

describe('initDebugController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set DEBUG on window', () => {
    const win = {} as Window;
    const registerFn = vi.fn();
    const mockComponent = strictProxy<Component>({
      register: registerFn
    });
    initDebugController(win, mockComponent);
    expect(ensureGenericObject(win)['DEBUG']).toBeDefined();
    expect(registerFn).toHaveBeenCalled();
    expect(mocks.getDebugController).toHaveBeenCalled();
  });
});

describe('initPluginContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set plugin id and show debug message', () => {
    mocks.compareVersions.mockReturnValue(1);
    const mockStyleEl = {};
    const mockHead = {
      createEl: vi.fn(() => mockStyleEl),
      querySelector: vi.fn(() => null)
    };
    vi.stubGlobal('document', { head: mockHead });
    initPluginContext(app, 'my-plugin');
    expect(mocks.setPluginId).toHaveBeenCalledWith('my-plugin');
    expect(mocks.showInitialDebugMessage).toHaveBeenCalledWith('my-plugin');
    vi.unstubAllGlobals();
  });

  it('should skip style injection when version is not newer', () => {
    mocks.compareVersions.mockReturnValue(0);
    initPluginContext(app, 'my-plugin');
    expect(mocks.setPluginId).toHaveBeenCalledWith('my-plugin');
  });

  it('should remove old styles and inject new ones when version is newer', () => {
    mocks.compareVersions.mockReturnValue(1);
    const oldStyleEl = { remove: vi.fn() };
    const newStyleEl = {};
    const mockHead = {
      createEl: vi.fn(() => newStyleEl),
      querySelector: vi.fn(() => oldStyleEl)
    };
    vi.stubGlobal('document', { head: mockHead });
    initPluginContext(app, 'my-plugin');
    expect(oldStyleEl.remove).toHaveBeenCalled();
    expect(mockHead.createEl).toHaveBeenCalledWith('style', {
      attr: { id: 'obsidian-dev-utils-styles' },
      text: '.test { color: red; }'
    });
    vi.unstubAllGlobals();
  });

  it('should update lastLibraryVersion when version is newer', () => {
    mocks.compareVersions.mockReturnValue(1);
    const wrapper = { value: '0.0.0' };
    mocks.getObsidianDevUtilsState.mockReturnValue(wrapper);
    const mockHead = {
      createEl: vi.fn(() => ({})),
      querySelector: vi.fn(() => null)
    };
    vi.stubGlobal('document', { head: mockHead });
    initPluginContext(app, 'my-plugin');
    expect(wrapper.value).toBe('1.0.0');
    vi.unstubAllGlobals();
  });
});
