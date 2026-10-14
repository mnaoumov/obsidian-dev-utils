import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { lint } from './eslint.ts';

const { mockGeneric } = vi.hoisted(() => ({
  mockGeneric: vi.fn()
}));

vi.mock('@mnaoumov/typescript-dev-toolkit/linters/eslint', () => ({
  lint: mockGeneric
}));

vi.mock('../templates.ts', () => ({
  getTemplateFilePath: (name: string): string => `/pkg/dist/templates/${name}`
}));

describe('lint', () => {
  it('should hand the generic runner this package\'s eslint.config.mts template as the default', async () => {
    await lint({ paths: ['a'] });
    expect(mockGeneric).toHaveBeenCalledWith({ defaultConfigFilePath: '/pkg/dist/templates/eslint.config.mts', paths: ['a'] });
  });

  it('should let the caller override the default', async () => {
    await lint({ defaultConfigFilePath: '/custom' });
    expect(mockGeneric).toHaveBeenCalledWith({ defaultConfigFilePath: '/custom' });
  });

  it('should run with no options', async () => {
    await lint();
    expect(mockGeneric).toHaveBeenCalledWith({ defaultConfigFilePath: '/pkg/dist/templates/eslint.config.mts' });
  });
});
