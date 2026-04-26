import type {
  App as AppOriginal,
  Component
} from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
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

  it('should add library name, plugin id, and custom css class string', () => {
    const addClass = vi.fn();
    const el = strictProxy<HTMLElement>({ addClass });
    addPluginCssClasses(el, 'custom-class');
    expect(addClass).toHaveBeenCalledWith('obsidian-dev-utils', 'test-plugin', 'custom-class');
  });

  it('should add library name, plugin id, and custom css classes array', () => {
    const addClass = vi.fn();
    const el = strictProxy<HTMLElement>({ addClass });
    addPluginCssClasses(el, ['class-a', 'class-b']);
    expect(addClass).toHaveBeenCalledWith('obsidian-dev-utils', 'test-plugin', 'class-a', 'class-b');
  });

  it('should add only library name and plugin id when no css classes provided', () => {
    const addClass = vi.fn();
    const el = strictProxy<HTMLElement>({ addClass });
    addPluginCssClasses(el);
    expect(addClass).toHaveBeenCalledWith('obsidian-dev-utils', 'test-plugin');
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

  it('should restore old DEBUG on cleanup when DEBUG is still ours', () => {
    const oldDebug = { old: true };
    const win: Window = { DEBUG: oldDebug } as never;
    const registerFn = vi.fn();
    const mockComponent = strictProxy<Component>({
      register: registerFn
    });
    initDebugController(win, mockComponent);
    const winObj = ensureGenericObject(win);

    // The cleanup function was registered
    const cleanupFn = registerFn.mock.calls[0]?.[0] as () => void;

    // DEBUG is still ours, so cleanup should restore old value
    cleanupFn();
    expect(winObj['DEBUG']).toBe(oldDebug);
  });

  it('should not restore old DEBUG on cleanup when DEBUG was changed by another plugin', () => {
    const win = {} as Window;
    const registerFn = vi.fn();
    const mockComponent = strictProxy<Component>({
      register: registerFn
    });
    initDebugController(win, mockComponent);
    const winObj = ensureGenericObject(win);

    const cleanupFn = registerFn.mock.calls[0]?.[0] as () => void;

    // Simulate another plugin changing DEBUG
    const anotherDebug = { another: true };
    winObj['DEBUG'] = anotherDebug;

    cleanupFn();
    // Should NOT restore, since DEBUG was changed by someone else
    expect(winObj['DEBUG']).toBe(anotherDebug);
  });
});

describe('initPluginContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should set plugin id and show debug message', () => {
    mocks.compareVersions.mockReturnValue(1);
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need to access document.
    vi.spyOn(document.head, 'querySelector').mockReturnValue(null);
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need to access document.
    vi.spyOn(document.head, 'createEl').mockReturnValue(createEl('style'));
    initPluginContext(app, 'my-plugin');
    expect(mocks.setPluginId).toHaveBeenCalledWith('my-plugin');
    expect(mocks.showInitialDebugMessage).toHaveBeenCalledWith('my-plugin');
  });

  it('should skip style injection when version is not newer', () => {
    mocks.compareVersions.mockReturnValue(0);
    initPluginContext(app, 'my-plugin');
    expect(mocks.setPluginId).toHaveBeenCalledWith('my-plugin');
  });

  it('should remove old styles and inject new ones when version is newer', () => {
    mocks.compareVersions.mockReturnValue(1);
    const oldStyleEl = { remove: vi.fn() };
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need to access document.
    vi.spyOn(document.head, 'querySelector').mockReturnValue(oldStyleEl as never);
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need to access document.
    const createElSpy = vi.spyOn(document.head, 'createEl').mockReturnValue(createEl('style'));
    initPluginContext(app, 'my-plugin');
    expect(oldStyleEl.remove).toHaveBeenCalled();
    expect(createElSpy).toHaveBeenCalledWith('style', {
      attr: { id: 'obsidian-dev-utils-styles' },
      text: '.test { color: red; }'
    });
  });

  it('should update lastLibraryVersion when version is newer', () => {
    mocks.compareVersions.mockReturnValue(1);
    const wrapper = { value: '0.0.0' };
    mocks.getObsidianDevUtilsState.mockReturnValue(wrapper);
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need to access document.
    vi.spyOn(document.head, 'querySelector').mockReturnValue(null);
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need to access document.
    vi.spyOn(document.head, 'createEl').mockReturnValue(createEl('style'));
    initPluginContext(app, 'my-plugin');
    expect(wrapper.value).toBe('1.0.0');
  });
});
