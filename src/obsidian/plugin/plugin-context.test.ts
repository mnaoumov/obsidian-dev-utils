import type { Component } from 'obsidian';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { Library } from '../../library.ts';
import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { ensureGenericObject } from '../../type-guards.ts';
import {
  addPluginCssClasses,
  initDebugController,
  initPluginContext
} from './plugin-context.ts';

const mocks = vi.hoisted(() => ({
  compareVersions: vi.fn((_a: string, _b: string) => 1),
  getDebugController: vi.fn(() => ({})),
  getObsidianDevUtilsState: vi.fn(() => ({ value: '0.0.0' })),
  showInitialDebugMessage: vi.fn()
}));

vi.mock('compare-versions', () => ({
  compareVersions: mocks.compareVersions
}));

vi.mock('../../debug-controller.ts', () => ({}));

vi.mock('../css-class.ts', () => ({
  CssClass: { LibraryName: 'obsidian-dev-utils' }
}));

vi.mock('../../debug.ts', () => ({
  getDebugController: mocks.getDebugController,
  showInitialDebugMessage: mocks.showInitialDebugMessage
}));

vi.mock('../../generated-during-build.ts', () => ({
  LIBRARY_STYLES: '.test { color: red; }',
  LIBRARY_VERSION: '1.0.0'
}));

vi.mock('../../obsidian-dev-utils-state.ts', () => ({
  getObsidianDevUtilsState: mocks.getObsidianDevUtilsState
}));

describe('addPluginCssClasses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Library.init({ cssClassScope: 'test-plugin', debugPrefixNamespace: '', shouldPrintStackTrace: false });
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

  it('should omit the scope class when the css class scope is empty', () => {
    Library.resetToDefault();
    const addClass = vi.fn();
    const el = strictProxy<HTMLElement>({ addClass });
    addPluginCssClasses(el, 'custom-class');
    expect(addClass).toHaveBeenCalledWith('obsidian-dev-utils', 'custom-class');
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
    const win = castTo<Window>({ DEBUG: oldDebug });
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

  it('should initialize the Library and show debug message', () => {
    mocks.compareVersions.mockReturnValue(1);
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need to access document.
    vi.spyOn(document.head, 'querySelector').mockReturnValue(null);
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need to access document.
    vi.spyOn(document.head, 'createEl').mockReturnValue(createEl('style'));
    initPluginContext('my-plugin');
    expect(Library.cssClassScope).toBe('my-plugin');
    expect(Library.debugPrefixNamespace).toBe('my-plugin:');
    expect(Library.shouldPrintStackTrace).toBe(true);
    expect(mocks.showInitialDebugMessage).toHaveBeenCalledWith('my-plugin');
  });

  it('should skip style injection when version is not newer', () => {
    mocks.compareVersions.mockReturnValue(0);
    initPluginContext('my-plugin');
    expect(Library.cssClassScope).toBe('my-plugin');
  });

  it('should remove old styles and inject new ones when version is newer', () => {
    mocks.compareVersions.mockReturnValue(1);
    const oldStyleEl = strictProxy<Element>({ remove: vi.fn() });
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need to access document.
    vi.spyOn(document.head, 'querySelector').mockReturnValue(oldStyleEl);
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need to access document.
    const createElSpy = vi.spyOn(document.head, 'createEl').mockReturnValue(createEl('style'));
    initPluginContext('my-plugin');
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
    initPluginContext('my-plugin');
    expect(wrapper.value).toBe('1.0.0');
  });
});
