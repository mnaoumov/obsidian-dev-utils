import {
  describe,
  expect,
  it
} from 'vitest';

import { castTo } from '../object-utils.ts';
import { isInObsidian } from './is-in-obsidian.ts';

describe('isInObsidian', () => {
  it('should return true when global app exists', () => {
    expect(isInObsidian()).toBe(true);
  });

  it('should return false when global app does not exist', () => {
    // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
    const saved = castTo<Record<string, unknown>>(globalThis)['app'];
    // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
    delete castTo<Record<string, unknown>>(globalThis)['app'];
    try {
      expect(isInObsidian()).toBe(false);
    } finally {
      // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
      castTo<Record<string, unknown>>(globalThis)['app'] = saved;
    }
  });
});
