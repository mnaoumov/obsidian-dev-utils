import {
  afterEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  getObsidianDevUtilsState,
  resetObsidianDevUtilsState
} from './obsidian-dev-utils-state.ts';
import { ValueWrapper } from './value-wrapper.ts';

interface GlobalThisWithState {
  __obsidianDevUtils: unknown;
}

describe('getObsidianDevUtilsState', () => {
  afterEach(() => {
    // eslint-disable-next-line obsidianmd/no-global-this -- The shared state intentionally lives on the realm global.
    delete (globalThis as Partial<GlobalThisWithState>).__obsidianDevUtils;
  });

  it('should return a ValueWrapper with the default value when key is new', () => {
    const wrapper = getObsidianDevUtilsState('newKey', 'default');
    expect(wrapper.value).toBe('default');
  });

  it('should return the same ValueWrapper on second call with same key', () => {
    const first = getObsidianDevUtilsState('sameKey', 10);
    const second = getObsidianDevUtilsState('sameKey', 20);
    expect(second).toBe(first);
  });

  it('should return different ValueWrappers for different keys', () => {
    const a = getObsidianDevUtilsState('keyA', 1);
    const b = getObsidianDevUtilsState('keyB', 2);
    expect(a).not.toBe(b);
  });

  it('should store the shared state on globalThis', () => {
    const wrapper = getObsidianDevUtilsState('globalKey', 'gVal');
    expect(wrapper).toBeInstanceOf(ValueWrapper);
  });

  it('should allow the value to be modified through the wrapper', () => {
    const wrapper = getObsidianDevUtilsState('mutable', 'initial');
    wrapper.value = 'changed';
    const same = getObsidianDevUtilsState('mutable', 'initial');
    expect(same.value).toBe('changed');
  });

  it('should drop the shared state when reset', () => {
    const first = getObsidianDevUtilsState('resettable', 'a');
    resetObsidianDevUtilsState();
    const second = getObsidianDevUtilsState('resettable', 'b');
    expect(second).not.toBe(first);
    expect(second.value).toBe('b');
  });
});
