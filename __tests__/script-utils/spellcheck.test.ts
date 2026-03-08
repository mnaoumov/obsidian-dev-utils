import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { spellcheck } from '../../src/script-utils/linters/cspell.ts';

const { mockExecFromRoot } = vi.hoisted(() => ({
  mockExecFromRoot: vi.fn()
}));

vi.mock('../../src/script-utils/root.ts', () => ({
  execFromRoot: mockExecFromRoot
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
});

describe('spellcheck', () => {
  it('should run cspell via execFromRoot', async () => {
    await spellcheck();
    expect(mockExecFromRoot).toHaveBeenCalledWith('npx cspell . --no-progress');
  });
});
