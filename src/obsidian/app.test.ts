import {
  afterEach,
  describe,
  expect,
  it
} from 'vitest';

import { ValueWrapper } from '../value-wrapper.ts';
import {
  // eslint-disable-next-line import-x/no-deprecated -- Testing `getApp()`.
  getApp,
  getObsidianDevUtilsState
} from './app.ts';

interface GlobalThisWithApp {
  app: unknown;
}

interface GlobalThisWithState {
  obsidianDevUtilsState: unknown;
}

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
