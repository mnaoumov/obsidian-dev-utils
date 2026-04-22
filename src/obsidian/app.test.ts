import {
  afterEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  // eslint-disable-next-line import-x/no-deprecated -- Testing `getApp()`.
  getApp,
  getObsidianDevUtilsState,
  ValueWrapper
} from './app.ts';

interface GlobalThisWithApp {
  app: unknown;
}

interface GlobalThisWithState {
  obsidianDevUtilsState: unknown;
}

describe('ValueWrapper', () => {
  it('should store a number value', () => {
    const wrapper = new ValueWrapper(42);
    expect(wrapper.value).toBe(42);
  });

  it('should store a string value', () => {
    const wrapper = new ValueWrapper('hello');
    expect(wrapper.value).toBe('hello');
  });

  it('should store an object value', () => {
    const obj = { key: 'val' };
    const wrapper = new ValueWrapper(obj);
    expect(wrapper.value).toBe(obj);
  });

  it('should store null', () => {
    const wrapper = new ValueWrapper(null);
    expect(wrapper.value).toBeNull();
  });

  it('should store undefined', () => {
    const wrapper = new ValueWrapper(undefined);
    expect(wrapper.value).toBeUndefined();
  });

  it('should allow the value to be overwritten', () => {
    const wrapper = new ValueWrapper(1);
    wrapper.value = 99;
    expect(wrapper.value).toBe(99);
  });
});

describe('getApp', () => {
  afterEach(() => {
    // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
    delete (globalThis as Partial<GlobalThisWithApp>).app;
  });

  it('should return globalThis.app when it exists', () => {
    const mockApp = { vault: {} };
    // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
    (globalThis as Partial<GlobalThisWithApp>).app = mockApp;
    // eslint-disable-next-line @typescript-eslint/no-deprecated, import-x/no-deprecated -- Testing `getApp()`.
    expect(getApp()).toBe(mockApp);
  });

  it('should throw when no global app exists and require fails', () => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated, import-x/no-deprecated -- Testing `getApp()`.
    expect(() => getApp()).toThrow('Obsidian App global instance not found');
  });
});

describe('getObsidianDevUtilsState', () => {
  afterEach(() => {
    // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
    delete (globalThis as Partial<GlobalThisWithState>).obsidianDevUtilsState;
  });

  it('should return a ValueWrapper with the default value when key is new', () => {
    const wrapper = getObsidianDevUtilsState(null, 'newKey', 'default');
    expect(wrapper.value).toBe('default');
  });

  it('should return the same ValueWrapper on second call with same key', () => {
    const first = getObsidianDevUtilsState(null, 'sameKey', 10);
    const second = getObsidianDevUtilsState(null, 'sameKey', 20);
    expect(second).toBe(first);
  });

  it('should return different ValueWrappers for different keys', () => {
    const a = getObsidianDevUtilsState(null, 'keyA', 1);
    const b = getObsidianDevUtilsState(null, 'keyB', 2);
    expect(a).not.toBe(b);
  });

  it('should use globalThis when app is null and window is undefined', () => {
    const wrapper = getObsidianDevUtilsState(null, 'globalKey', 'gVal');
    expect(wrapper).toBeInstanceOf(ValueWrapper);
  });

  it('should allow the value to be modified through the wrapper', () => {
    const wrapper = getObsidianDevUtilsState(null, 'mutable', 'initial');
    wrapper.value = 'changed';
    const same = getObsidianDevUtilsState(null, 'mutable', 'initial');
    expect(same.value).toBe('changed');
  });
});
