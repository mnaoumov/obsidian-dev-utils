import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { format } from './dprint.ts';

const { mockGeneric } = vi.hoisted(() => ({
  mockGeneric: vi.fn()
}));

vi.mock('@mnaoumov/typescript-dev-toolkit/formatters/dprint', () => ({
  format: mockGeneric
}));

vi.mock('../templates.ts', () => ({
  getTemplateFilePath: (name: string): string => `/pkg/dist/templates/${name}`
}));

describe('format', () => {
  it('should hand the generic runner this package\'s dprint.json template as the default', async () => {
    await format({ paths: ['a'] });
    expect(mockGeneric).toHaveBeenCalledWith({ defaultConfigFilePath: '/pkg/dist/templates/dprint.json', paths: ['a'] });
  });

  it('should let the caller override the default', async () => {
    await format({ defaultConfigFilePath: '/custom' });
    expect(mockGeneric).toHaveBeenCalledWith({ defaultConfigFilePath: '/custom' });
  });

  it('should run with no options', async () => {
    await format();
    expect(mockGeneric).toHaveBeenCalledWith({ defaultConfigFilePath: '/pkg/dist/templates/dprint.json' });
  });
});
