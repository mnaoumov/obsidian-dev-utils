import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type {
  CheckProjectTypesParams,
  ParsedTsConfig
} from './check-project-types.ts';

import { validateDeclarations } from './validate-declarations.ts';

const {
  mockCheckProjectTypes,
  mockGetRootFolder,
  mockParseTsConfig,
  mockToCanonical
} = vi.hoisted(() => ({
  mockCheckProjectTypes: vi.fn<(params: CheckProjectTypesParams) => boolean>(),
  mockGetRootFolder: vi.fn<() => string>(),
  mockParseTsConfig: vi.fn<(tsConfigPath: string) => ParsedTsConfig>(),
  mockToCanonical: vi.fn<(fileName: string) => string>()
}));

vi.mock('./check-project-types.ts', () => ({
  checkProjectTypes: mockCheckProjectTypes,
  parseTsConfig: mockParseTsConfig,
  toCanonical: mockToCanonical
}));

vi.mock('./root.ts', () => ({
  getRootFolder: mockGetRootFolder
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockGetRootFolder.mockReturnValue('/root');
  mockToCanonical.mockImplementation((fileName) => fileName);
  mockParseTsConfig.mockReturnValue({ fileNames: ['/root/dist/lib/cjs/a.d.cts'], options: {} });
  mockCheckProjectTypes.mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('validateDeclarations', () => {
  it('should throw when the root folder cannot be found', () => {
    mockGetRootFolder.mockReturnValue('');
    expect(() => validateDeclarations()).toThrow('Could not find root folder');
  });

  it('should validate both declaration configs and return true when both pass', () => {
    const result = validateDeclarations();

    expect(result).toBe(true);
    expect(mockCheckProjectTypes).toHaveBeenCalledTimes(2);
    expect(mockParseTsConfig).toHaveBeenNthCalledWith(1, '/root/tsconfig.validate-declarations.json');
    expect(mockParseTsConfig).toHaveBeenNthCalledWith(2, '/root/tsconfig.validate-declarations-cjs.json');
  });

  it('should still check both configs and return false when the first config fails', () => {
    mockCheckProjectTypes.mockReturnValueOnce(false).mockReturnValueOnce(true);

    const result = validateDeclarations();

    expect(result).toBe(false);
    expect(mockCheckProjectTypes).toHaveBeenCalledTimes(2);
  });

  it('should return false when the second config fails', () => {
    mockCheckProjectTypes.mockReturnValueOnce(true).mockReturnValueOnce(false);

    expect(validateDeclarations()).toBe(false);
  });

  it('should forward isVerbose to checkProjectTypes when provided', () => {
    validateDeclarations({ isVerbose: true });

    expect(firstCallParams().isVerbose).toBe(true);
  });

  it('should default isVerbose to false when no options are provided', () => {
    validateDeclarations();

    expect(firstCallParams().isVerbose).toBe(false);
  });

  it('should not pass a shouldKeepDiagnostic predicate so every owned diagnostic is reported', () => {
    validateDeclarations();

    expect(firstCallParams().shouldKeepDiagnostic).toBeUndefined();
  });

  describe('shouldKeepFile', () => {
    it('should keep files under the root that are not in node_modules and drop the rest', () => {
      validateDeclarations();
      const { shouldKeepFile } = firstCallParams();

      expect(shouldKeepFile('/root/dist/lib/cjs/a.d.cts')).toBe(true);
      expect(shouldKeepFile('/root/node_modules/type-fest/index.d.ts')).toBe(false);
      expect(shouldKeepFile('/other/a.d.cts')).toBe(false);
    });
  });
});

function firstCallParams(): CheckProjectTypesParams {
  const params = mockCheckProjectTypes.mock.calls[0]?.[0];
  if (!params) {
    throw new Error('checkProjectTypes was not called');
  }
  return params;
}
