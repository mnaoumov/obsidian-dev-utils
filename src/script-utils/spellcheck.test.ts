import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ResolveToolCommandParams } from './package-manager.ts';

import { spellcheck } from './linters/cspell.ts';

const { mockExecFromRoot, mockGetRootFolder, mockResolveToolCommand } = vi.hoisted(() => ({
  mockExecFromRoot: vi.fn(),
  mockGetRootFolder: vi.fn<(cwd?: string) => null | string>(),
  mockResolveToolCommand: vi.fn<(params: ResolveToolCommandParams) => string[]>()
}));

vi.mock('../script-utils/root.ts', () => ({
  execFromRoot: mockExecFromRoot,
  getRootFolder: mockGetRootFolder
}));

vi.mock('../script-utils/package-manager.ts', () => ({
  resolveToolCommand: mockResolveToolCommand
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
  mockGetRootFolder.mockReturnValue('/root');
  mockResolveToolCommand.mockImplementation((params: ResolveToolCommandParams) => [params.tool]);
});

describe('spellcheck', () => {
  it('should run cspell via execFromRoot', async () => {
    await spellcheck();
    expect(mockExecFromRoot).toHaveBeenCalledWith([
      'cspell',
      '--no-progress',
      '--no-must-find-files',
      '--gitignore',
      '--gitignore-root',
      '/root',
      { batchedArguments: ['.'] }
    ]);
  });

  it('should omit --gitignore-root when the root folder cannot be resolved', async () => {
    mockGetRootFolder.mockReturnValue(null);
    await spellcheck();
    expect(mockExecFromRoot).toHaveBeenCalledWith([
      'cspell',
      '--no-progress',
      '--no-must-find-files',
      '--gitignore',
      { batchedArguments: ['.'] }
    ]);
  });
});
