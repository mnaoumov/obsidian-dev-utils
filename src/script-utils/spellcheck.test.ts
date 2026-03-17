import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { spellcheck } from './linters/cspell.ts';

const { mockExecFromRoot } = vi.hoisted(() => ({
  mockExecFromRoot: vi.fn()
}));

vi.mock('../script-utils/root.ts', () => ({
  execFromRoot: mockExecFromRoot
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
});

describe('spellcheck', () => {
  it('should run cspell via execFromRoot', async () => {
    await spellcheck();
    expect(mockExecFromRoot).toHaveBeenCalledWith(['npx', 'cspell', '--no-progress', '--no-must-find-files', { batchedArgs: ['.'] }]);
  });
});
