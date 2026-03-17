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
    const saved = castTo<Record<string, unknown>>(globalThis)['app'];
    delete castTo<Record<string, unknown>>(globalThis)['app'];
    try {
      expect(isInObsidian()).toBe(false);
    } finally {
      castTo<Record<string, unknown>>(globalThis)['app'] = saved;
    }
  });
});
