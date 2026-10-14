import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { getTemplateFilePath } from './templates.ts';

const { mockGetRootFolder } = vi.hoisted(() => ({
  mockGetRootFolder: vi.fn<(cwd?: string) => null | string>()
}));

vi.mock('@mnaoumov/typescript-dev-toolkit/root', () => ({
  getRootFolder: mockGetRootFolder
}));

describe('getTemplateFilePath', () => {
  it('should resolve a template inside this package\'s dist/templates', () => {
    mockGetRootFolder.mockReturnValue('/pkg');
    expect(getTemplateFilePath('eslint.config.mts')).toBe('/pkg/dist/templates/eslint.config.mts');
    expect(mockGetRootFolder).toHaveBeenCalledWith(expect.stringMatching(/obsidian-dev-toolkit[\\/]src$/));
  });

  it('should throw when the package folder cannot be found', () => {
    mockGetRootFolder.mockReturnValue(null);
    expect(() => getTemplateFilePath('eslint.config.mts')).toThrow('Package folder not found');
  });
});
