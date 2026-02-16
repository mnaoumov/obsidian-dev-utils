import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  addPluginCssClasses,
  initDebugController,
  initPluginContext
} from '../../../src/obsidian/Plugin/PluginContext.ts';
import { ensureGenericObject } from '../../../src/TypeGuards.ts';

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

vi.mock('../../../src/DebugController.ts', () => ({}));

vi.mock('../../../src/CssClass.ts', () => ({
  CssClass: { LibraryName: 'obsidian-dev-utils' }
}));

vi.mock('../../../src/Debug.ts', () => ({
  getDebugController: mocks.getDebugController,
  showInitialDebugMessage: mocks.showInitialDebugMessage
}));

vi.mock('../../../src/Library.ts', () => ({
  LIBRARY_NAME: 'obsidian-dev-utils',
  LIBRARY_STYLES: '.test { color: red; }',
  LIBRARY_VERSION: '1.0.0'
}));

vi.mock('../../../src/obsidian/App.ts', () => ({
  getObsidianDevUtilsState: mocks.getObsidianDevUtilsState
}));

vi.mock('../../../src/obsidian/Plugin/PluginId.ts', () => ({
  getPluginId: mocks.getPluginId,
  setPluginId: mocks.setPluginId
}));

describe('addPluginCssClasses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add library name, plugin id, and custom css classes', () => {
    const addClass = vi.fn();
    const el = { addClass } as unknown as HTMLElement;
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
    initDebugController(win);
    expect(ensureGenericObject(win)['DEBUG']).toBeDefined();
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
    initPluginContext({} as never, 'my-plugin');
    expect(mocks.setPluginId).toHaveBeenCalledWith('my-plugin');
    expect(mocks.showInitialDebugMessage).toHaveBeenCalledWith('my-plugin');
    vi.unstubAllGlobals();
  });

  it('should skip style injection when version is not newer', () => {
    mocks.compareVersions.mockReturnValue(0);
    initPluginContext({} as never, 'my-plugin');
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
    initPluginContext({} as never, 'my-plugin');
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
    initPluginContext({} as never, 'my-plugin');
    expect(wrapper.value).toBe('1.0.0');
    vi.unstubAllGlobals();
  });
});
