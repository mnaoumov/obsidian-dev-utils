import type { ValueWrapper } from '@mnaoumov/typescript-lib/value-wrapper';
import type { Component } from 'obsidian';

import { ResettableAbortController } from '@mnaoumov/typescript-lib/abort-controller';
import { Library } from '@mnaoumov/typescript-lib/library';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { ensureGenericObject } from '@mnaoumov/typescript-lib/type-guards';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { ObsidianLibrary } from '../library.ts';
import {
  addPluginCssClasses,
  initDebugController,
  initPluginContext
} from './plugin-context.ts';

interface GlobalThisWithState {
  __obsidianDevUtils: ObsidianDevUtilsState;
}

interface ObsidianDevUtilsState {
  sharedAbortController: ValueWrapper<ResettableAbortController>;
}

const mocks = vi.hoisted(() => ({
  getDebugController: vi.fn(() => ({})),
  injectLibraryStyles: vi.fn(),
  showInitialDebugMessage: vi.fn()
}));

vi.mock('../library-styles.ts', () => ({
  injectLibraryStyles: mocks.injectLibraryStyles
}));

vi.mock('@mnaoumov/typescript-lib/debug-controller', () => ({}));

vi.mock('../css-class.ts', () => ({
  CssClass: { LibraryName: 'obsidian-dev-utils' }
}));

vi.mock('@mnaoumov/typescript-lib/debug', () => ({
  getDebugController: mocks.getDebugController,
  showInitialDebugMessage: mocks.showInitialDebugMessage
}));

vi.mock('../generated-during-build.ts', () => ({
  LIBRARY_STYLES: '.test { color: red; }',
  LIBRARY_VERSION: '1.0.0'
}));

describe('addPluginCssClasses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ObsidianLibrary.init({ cssClassScope: 'test-plugin' });
  });

  it('should add library name, plugin id, and custom css class string', () => {
    const addClass = vi.fn();
    const element = strictProxy<HTMLElement>({ addClass });
    addPluginCssClasses(element, 'custom-class');
    expect(addClass).toHaveBeenCalledWith('obsidian-dev-utils', 'test-plugin', 'custom-class');
  });

  it('should add library name, plugin id, and custom css classes array', () => {
    const addClass = vi.fn();
    const element = strictProxy<HTMLElement>({ addClass });
    addPluginCssClasses(element, ['class-a', 'class-b']);
    expect(addClass).toHaveBeenCalledWith('obsidian-dev-utils', 'test-plugin', 'class-a', 'class-b');
  });

  it('should add only library name and plugin id when no css classes provided', () => {
    const addClass = vi.fn();
    const element = strictProxy<HTMLElement>({ addClass });
    addPluginCssClasses(element);
    expect(addClass).toHaveBeenCalledWith('obsidian-dev-utils', 'test-plugin');
  });

  it('should omit the scope class when the css class scope is empty', () => {
    ObsidianLibrary.resetToDefault();
    const addClass = vi.fn();
    const element = strictProxy<HTMLElement>({ addClass });
    addPluginCssClasses(element, 'custom-class');
    expect(addClass).toHaveBeenCalledWith('obsidian-dev-utils', 'custom-class');
  });
});

describe('initDebugController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set DEBUG on window', () => {
    const win = {} as Window;
    const registerFunction = vi.fn();
    const mockComponent = strictProxy<Component>({
      register: registerFunction
    });
    initDebugController(win, mockComponent);
    expect(ensureGenericObject(win)['DEBUG']).toBeDefined();
    expect(registerFunction).toHaveBeenCalled();
    expect(mocks.getDebugController).toHaveBeenCalled();
  });

  it('should restore old DEBUG on cleanup when DEBUG is still ours', () => {
    const oldDebug = { old: true };
    const win = castTo<Window>({ DEBUG: oldDebug });
    const registerFunction = vi.fn();
    const mockComponent = strictProxy<Component>({
      register: registerFunction
    });
    initDebugController(win, mockComponent);
    const winObject = ensureGenericObject(win);

    // The cleanup function was registered
    const cleanupFunction = registerFunction.mock.calls[0]?.[0] as () => void;

    // DEBUG is still ours, so cleanup should restore old value
    cleanupFunction();
    expect(winObject['DEBUG']).toBe(oldDebug);
  });

  it('should not restore old DEBUG on cleanup when DEBUG was changed by another plugin', () => {
    const win = {} as Window;
    const registerFunction = vi.fn();
    const mockComponent = strictProxy<Component>({
      register: registerFunction
    });
    initDebugController(win, mockComponent);
    const winObject = ensureGenericObject(win);

    const cleanupFunction = registerFunction.mock.calls[0]?.[0] as () => void;

    // Simulate another plugin changing DEBUG
    const anotherDebug = { another: true };
    winObject['DEBUG'] = anotherDebug;

    cleanupFunction();
    // Should NOT restore, since DEBUG was changed by someone else
    expect(winObject['DEBUG']).toBe(anotherDebug);
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
    initPluginContext('my-plugin');
    expect(ObsidianLibrary.cssClassScope).toBe('my-plugin');
    expect(Library.debugNamespace).toBe('obsidian-dev-utils');
    expect(Library.debugPrefixNamespace).toBe('my-plugin:');
    expect(Library.shouldPrintStackTrace).toBe(true);
    expect(Library.debugGuideUrl).toBe('https://mnaoumov.dev/obsidian-dev-utils/guides/debugging/');
    expect(mocks.showInitialDebugMessage).toHaveBeenCalledWith('my-plugin');
  });

  it('should inject the library styles of this copy', () => {
    initPluginContext('my-plugin');
    expect(mocks.injectLibraryStyles).toHaveBeenCalledWith({
      doc: document,
      libraryStyles: '.test { color: red; }',
      libraryVersion: '1.0.0'
    });
  });

  // The shared abort controller is documented as callable straight from the devtools console
  // (`__obsidianDevUtils.sharedAbortController.value.abort()`). Nothing else in the library touches it, so
  // without this eager call the key would be absent until a consumer plugin happened to start an operation,
  // and the documented console line would throw instead of aborting. This asserts the console path itself,
  // reaching the global exactly as the console does. The controller itself lives in the generic shared state, so this
  // also proves the plugin init links it back under `__obsidianDevUtils`.
  it('should create the shared abort controller so the console call always resolves', () => {
    // eslint-disable-next-line obsidianmd/no-global-this -- The shared state intentionally lives on the realm global, which is what the documented console call reaches.
    delete castTo<Partial<GlobalThisWithState>>(globalThis).__obsidianDevUtils;

    initPluginContext('my-plugin');

    // eslint-disable-next-line obsidianmd/no-global-this -- The shared state intentionally lives on the realm global, which is what the documented console call reaches.
    const state = castTo<GlobalThisWithState>(globalThis).__obsidianDevUtils;
    expect(state.sharedAbortController.value).toBeInstanceOf(ResettableAbortController);
  });
});
