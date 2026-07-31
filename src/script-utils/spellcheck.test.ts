import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { spellcheck } from './linters/cspell.ts';

const { mockExecFromRoot, mockGetRootFolder } = vi.hoisted(() => ({
  mockExecFromRoot: vi.fn(),
  mockGetRootFolder: vi.fn<(cwd?: string) => null | string>()
}));

vi.mock('../script-utils/root.ts', () => ({
  execFromRoot: mockExecFromRoot,
  getRootFolder: mockGetRootFolder
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
  mockGetRootFolder.mockReturnValue('/root');
});

describe('spellcheck', () => {
  it('should run cspell via execFromRoot', async () => {
    await spellcheck();
    expect(mockExecFromRoot).toHaveBeenCalledWith([
      'npx',
      'cspell',
      '--no-progress',
      '--no-must-find-files',
      '--gitignore',
      '--gitignore-root',
      '/root',
      { batchedArgs: ['.'] }
    ]);
  });

  it('should omit --gitignore-root when the root folder cannot be resolved', async () => {
    mockGetRootFolder.mockReturnValue(null);
    await spellcheck();
    expect(mockExecFromRoot).toHaveBeenCalledWith([
      'npx',
      'cspell',
      '--no-progress',
      '--no-must-find-files',
      '--gitignore',
      { batchedArgs: ['.'] }
    ]);
  });
});
