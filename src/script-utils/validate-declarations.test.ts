import type {
  Diagnostic,
  SourceFile
} from 'typescript';

import {
  createSourceFile,
  ScriptTarget
} from 'typescript';
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

import { strictProxy } from '../strict-proxy.ts';
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

  describe('shouldKeepFile', () => {
    it('should keep files under the root that are not in node_modules and drop the rest', () => {
      validateDeclarations();
      const { shouldKeepFile } = firstCallParams();

      expect(shouldKeepFile('/root/dist/lib/cjs/a.d.cts')).toBe(true);
      expect(shouldKeepFile('/root/node_modules/type-fest/index.d.ts')).toBe(false);
      expect(shouldKeepFile('/other/a.d.cts')).toBe(false);
    });
  });

  describe('shouldKeepDiagnostic', () => {
    it('should keep a diagnostic that has no source file', () => {
      expect(keepDiagnostic(strictProxy<Diagnostic>({ file: undefined }))).toBe(true);
    });

    it('should keep a diagnostic that has no start position', () => {
      const sourceFile = parse('import type { Promisable } from \'type-fest\';');
      expect(keepDiagnostic(strictProxy<Diagnostic>({ file: sourceFile, start: undefined }))).toBe(true);
    });

    it('should drop a diagnostic on a bare-specifier import declaration', () => {
      expect(keepDiagnostic(diagnosticAt('import type { Promisable } from \'type-fest\';', '\'type-fest\''))).toBe(false);
    });

    it('should drop a diagnostic on a bare-specifier export declaration', () => {
      expect(keepDiagnostic(diagnosticAt('export { Promisable } from \'type-fest\';', '\'type-fest\''))).toBe(false);
    });

    it('should drop a diagnostic on a bare-specifier inline import type', () => {
      expect(keepDiagnostic(diagnosticAt('type X = import(\'type-fest\').Promisable;', 'import('))).toBe(false);
    });

    it('should keep a diagnostic on a relative import declaration', () => {
      expect(keepDiagnostic(diagnosticAt('import type { Foo } from \'./foo.cjs\';', '\'./foo.cjs\''))).toBe(true);
    });

    it('should keep a diagnostic on a relative inline import type', () => {
      expect(keepDiagnostic(diagnosticAt('type X = import(\'./foo.cjs\').Foo;', 'import('))).toBe(true);
    });

    it('should keep a diagnostic on an export declaration without a module specifier', () => {
      expect(keepDiagnostic(diagnosticAt('export { Foo };', 'Foo'))).toBe(true);
    });

    it('should keep a diagnostic on an inline import type whose argument is not a literal type', () => {
      expect(keepDiagnostic(diagnosticAt('type X = import(Foo).Bar;', 'import('))).toBe(true);
    });

    it('should keep a diagnostic on an inline import type whose literal is not a string', () => {
      expect(keepDiagnostic(diagnosticAt('type X = import(123).Bar;', 'import('))).toBe(true);
    });

    it('should keep a diagnostic that is not positioned on any import or export', () => {
      expect(keepDiagnostic(diagnosticAt('export type Foo = string;', 'string'))).toBe(true);
    });
  });
});

function diagnosticAt(text: string, search: string): Diagnostic {
  return strictProxy<Diagnostic>({
    file: parse(text),
    start: text.indexOf(search)
  });
}

function firstCallParams(): CheckProjectTypesParams {
  const params = mockCheckProjectTypes.mock.calls[0]?.[0];
  if (!params) {
    throw new Error('checkProjectTypes was not called');
  }
  return params;
}

function keepDiagnostic(diagnostic: Diagnostic): boolean {
  validateDeclarations();
  const shouldKeepDiagnostic = firstCallParams().shouldKeepDiagnostic;
  if (!shouldKeepDiagnostic) {
    throw new Error('shouldKeepDiagnostic was not provided');
  }
  return shouldKeepDiagnostic(diagnostic);
}

function parse(text: string): SourceFile {
  return createSourceFile('test.d.cts', text, ScriptTarget.Latest, false);
}
