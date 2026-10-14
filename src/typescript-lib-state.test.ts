import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from './object-utils.ts';
import {
  getTypescriptLibState,
  getTypescriptLibStateSlot,
  resetTypescriptLibState,
  TYPESCRIPT_LIB_STATE_KEY,
  TYPESCRIPT_LIB_STATE_VERSION
} from './typescript-lib-state.ts';

describe('typescript-lib-state', () => {
  afterEach(() => {
    resetTypescriptLibState();
  });

  it('should create a wrapper holding the default value', () => {
    expect(getTypescriptLibState('key', 'default').value).toBe('default');
  });

  it('should return the same wrapper on repeat calls, ignoring a later default', () => {
    const wrapper = getTypescriptLibState('key', 'first');
    expect(getTypescriptLibState('key', 'second')).toBe(wrapper);
    expect(wrapper.value).toBe('first');
  });

  it('should drop every value on reset', () => {
    const wrapper = getTypescriptLibState('key', 'first');
    resetTypescriptLibState();
    expect(getTypescriptLibState('key', 'second')).not.toBe(wrapper);
  });

  it('should keep a versioned slot on the realm global under a registry symbol', () => {
    const wrapper = getTypescriptLibState('key', 1);

    expect(TYPESCRIPT_LIB_STATE_KEY).toBe(Symbol.for('@mnaoumov/typescript-lib/state'));
    // eslint-disable-next-line obsidianmd/no-global-this -- The shared state intentionally lives on the realm global.
    const slot = castTo<Record<symbol, unknown>>(globalThis)[TYPESCRIPT_LIB_STATE_KEY];
    expect(slot).toBe(getTypescriptLibStateSlot());
    expect(getTypescriptLibStateSlot()).toStrictEqual({ values: { key: wrapper }, version: TYPESCRIPT_LIB_STATE_VERSION });
  });

  it('should share the slot with a second loaded copy of the module', async () => {
    const wrapper = getTypescriptLibState('key', 'first');

    vi.resetModules();
    const secondCopy = await import('./typescript-lib-state.ts');
    expect(secondCopy.getTypescriptLibState).not.toBe(getTypescriptLibState);

    expect(secondCopy.getTypescriptLibState('key', 'second')).toBe(wrapper);
  });
});
