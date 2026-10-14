import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { lint } from './markdownlint.ts';

const { mockGeneric } = vi.hoisted(() => ({
  mockGeneric: vi.fn()
}));

vi.mock('@mnaoumov/typescript-dev-toolkit/linters/markdownlint', () => ({
  lint: mockGeneric
}));

vi.mock('../templates.ts', () => ({
  getTemplateFilePath: (name: string): string => `/pkg/dist/templates/${name}`
}));

describe('lint', () => {
  it('should hand the generic runner this package\'s .markdownlint-cli2.mjs template as the default', async () => {
    await lint({ paths: ['a'] });
    expect(mockGeneric).toHaveBeenCalledWith({ defaultConfigFilePath: '/pkg/dist/templates/.markdownlint-cli2.mjs', paths: ['a'] });
  });

  it('should let the caller override the default', async () => {
    await lint({ defaultConfigFilePath: '/custom' });
    expect(mockGeneric).toHaveBeenCalledWith({ defaultConfigFilePath: '/custom' });
  });

  it('should run with no options', async () => {
    await lint();
    expect(mockGeneric).toHaveBeenCalledWith({ defaultConfigFilePath: '/pkg/dist/templates/.markdownlint-cli2.mjs' });
  });
});
