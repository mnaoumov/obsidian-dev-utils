import type {
  CompilerOptions,
  CreateProgramOptions,
  Diagnostic,
  FormatDiagnosticsHost,
  ParseConfigFileHost,
  ParsedCommandLine,
  Program,
  SourceFile,
  System
} from 'typescript';

import process from 'node:process';
import { DiagnosticCategory } from 'typescript';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../strict-proxy.ts';
import {
  checkProjectTypes,
  parseTsConfig,
  toCanonical
} from './check-project-types.ts';

const {
  mockCreateProgram,
  mockFormatDiagnostic,
  mockFormatDiagnostics,
  mockFormatWithColor,
  mockGetParsedCommandLineOfConfigFile,
  mockGetPreEmitDiagnostics,
  mockSys
} = vi.hoisted(() => ({
  mockCreateProgram: vi.fn<(options: CreateProgramOptions) => Program>(),
  mockFormatDiagnostic: vi.fn<(diagnostic: Diagnostic, host: FormatDiagnosticsHost) => string>(),
  mockFormatDiagnostics: vi.fn<(diagnostics: readonly Diagnostic[], host: FormatDiagnosticsHost) => string>(),
  mockFormatWithColor: vi.fn<(diagnostics: readonly Diagnostic[], host: FormatDiagnosticsHost) => string>(),
  mockGetParsedCommandLineOfConfigFile: vi.fn<
    (configFileName: string, optionsToExtend: CompilerOptions | undefined, host: ParseConfigFileHost) => ParsedCommandLine | undefined
  >(),
  mockGetPreEmitDiagnostics: vi.fn<(program: Program) => readonly Diagnostic[]>(),
  mockSys: {
    fileExists: vi.fn<(path: string) => boolean>(),
    getCurrentDirectory: vi.fn<() => string>(),
    newLine: '\n',
    readDirectory: vi.fn<System['readDirectory']>(),
    readFile: vi.fn<(path: string) => string | undefined>(),
    useCaseSensitiveFileNames: true
  }
}));

vi.mock('typescript', async (importOriginal) => {
  const actual = await importOriginal<typeof import('typescript')>();
  return {
    ...actual,
    createProgram: mockCreateProgram,
    formatDiagnostic: mockFormatDiagnostic,
    formatDiagnostics: mockFormatDiagnostics,
    formatDiagnosticsWithColorAndContext: mockFormatWithColor,
    getParsedCommandLineOfConfigFile: mockGetParsedCommandLineOfConfigFile,
    getPreEmitDiagnostics: mockGetPreEmitDiagnostics,
    sys: mockSys
  };
});

const PROGRAM_STUB = strictProxy<Program>({});

beforeEach(() => {
  vi.resetAllMocks();
  mockSys.useCaseSensitiveFileNames = true;
  mockSys.newLine = '\n';
  mockSys.getCurrentDirectory.mockReturnValue('/cwd');
  mockCreateProgram.mockReturnValue(PROGRAM_STUB);
  mockGetPreEmitDiagnostics.mockReturnValue([]);
  mockFormatWithColor.mockReturnValue('formatted');
  mockFormatDiagnostic.mockReturnValue('formatted-diagnostic');
  mockFormatDiagnostics.mockReturnValue('formatted-diagnostics');
  vi.spyOn(process.stdout, 'write').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('toCanonical', () => {
  it('should lowercase and normalize separators on a case-insensitive file system', () => {
    mockSys.useCaseSensitiveFileNames = false;
    expect(toCanonical('C:\\Foo\\Bar.TS')).toBe('c:/foo/bar.ts');
  });

  it('should preserve case but normalize separators on a case-sensitive file system', () => {
    mockSys.useCaseSensitiveFileNames = true;
    expect(toCanonical('C:\\Foo\\Bar.TS')).toBe('C:/Foo/Bar.TS');
  });
});

describe('checkProjectTypes', () => {
  it('should force skipLibCheck to false and return true when there are no diagnostics', () => {
    const result = checkProjectTypes({
      options: { skipLibCheck: true, strict: true },
      rootNames: ['/root/a.ts'],
      shouldKeepFile: () => true
    });

    expect(result).toBe(true);
    const createProgramOptions = mockCreateProgram.mock.calls[0]?.[0];
    expect(createProgramOptions?.options.skipLibCheck).toBe(false);
    expect(createProgramOptions?.options.strict).toBe(true);
    expect(createProgramOptions?.rootNames).toEqual(['/root/a.ts']);
    expect(mockFormatWithColor).not.toHaveBeenCalled();
    expect(process.stdout.write).toHaveBeenCalledWith('Ignored 0 diagnostic(s) outside the validated set.\n');
  });

  it('should report only kept diagnostics and return false when a kept diagnostic is an error', () => {
    const keptError = createDiagnostic({ category: DiagnosticCategory.Error, fileName: '/root/keep.ts' });
    const droppedError = createDiagnostic({ category: DiagnosticCategory.Error, fileName: '/root/drop.ts' });
    const noFileWarning = createDiagnostic({ category: DiagnosticCategory.Warning });
    mockGetPreEmitDiagnostics.mockReturnValue([keptError, droppedError, noFileWarning]);
    mockFormatWithColor.mockImplementation((_diagnostics, host) => {
      host.getCanonicalFileName('/root/keep.ts');
      host.getCurrentDirectory();
      host.getNewLine();
      return 'formatted';
    });

    const result = checkProjectTypes({
      options: {},
      rootNames: ['/root/keep.ts'],
      shouldKeepFile: (fileName) => fileName.includes('keep')
    });

    expect(result).toBe(false);
    expect(mockFormatWithColor).toHaveBeenCalledWith([keptError, noFileWarning], expect.anything());
    expect(process.stdout.write).toHaveBeenCalledWith('formatted');
    expect(mockSys.getCurrentDirectory).toHaveBeenCalled();
  });

  it('should return true and still write output when all kept diagnostics are warnings', () => {
    const keptWarning = createDiagnostic({ category: DiagnosticCategory.Warning, fileName: '/root/keep.ts' });
    mockGetPreEmitDiagnostics.mockReturnValue([keptWarning]);

    const result = checkProjectTypes({
      options: {},
      rootNames: ['/root/keep.ts'],
      shouldKeepFile: () => true
    });

    expect(result).toBe(true);
    expect(process.stdout.write).toHaveBeenCalledWith('formatted');
  });

  it('should drop diagnostics rejected by shouldKeepDiagnostic even when their file is kept', () => {
    const keptError = createDiagnostic({ category: DiagnosticCategory.Error, fileName: '/root/keep.ts' });
    const interopError = createDiagnostic({ category: DiagnosticCategory.Error, fileName: '/root/keep.ts' });
    mockGetPreEmitDiagnostics.mockReturnValue([keptError, interopError]);

    const result = checkProjectTypes({
      options: {},
      rootNames: ['/root/keep.ts'],
      shouldKeepDiagnostic: (diagnostic) => diagnostic !== interopError,
      shouldKeepFile: () => true
    });

    expect(result).toBe(false);
    expect(mockFormatWithColor).toHaveBeenCalledWith([keptError], expect.anything());
    expect(process.stdout.write).toHaveBeenCalledWith('Ignored 1 diagnostic(s) outside the validated set.\n');
  });

  it('should skip output and return true when every diagnostic is ignored', () => {
    const droppedError = createDiagnostic({ category: DiagnosticCategory.Error, fileName: '/root/drop.ts' });
    mockGetPreEmitDiagnostics.mockReturnValue([droppedError]);

    const result = checkProjectTypes({
      options: {},
      rootNames: ['/root/keep.ts'],
      shouldKeepFile: () => false
    });

    expect(result).toBe(true);
    expect(mockFormatWithColor).not.toHaveBeenCalled();
    expect(process.stdout.write).toHaveBeenCalledTimes(1);
    expect(process.stdout.write).toHaveBeenCalledWith('Ignored 1 diagnostic(s) outside the validated set.\n');
  });
});

describe('parseTsConfig', () => {
  it('should return resolved file names and options, wiring the host to ts.sys', () => {
    mockSys.fileExists.mockReturnValue(true);
    mockSys.readFile.mockReturnValue('{}');
    mockSys.readDirectory.mockReturnValue([]);
    mockGetParsedCommandLineOfConfigFile.mockImplementation((configFileName, _optionsToExtend, host) => {
      expect(configFileName).toBe('/root/tsconfig.json');
      host.fileExists('/root/a.ts');
      host.getCurrentDirectory();
      host.readDirectory('/root', ['.ts'], [], ['**/*'], 1);
      host.readFile('/root/tsconfig.json');
      expect(host.useCaseSensitiveFileNames).toBe(true);
      return strictProxy<ParsedCommandLine>({
        errors: [],
        fileNames: ['/root/a.ts'],
        options: { strict: true }
      });
    });

    const result = parseTsConfig('/root/tsconfig.json');

    expect(result).toEqual({ fileNames: ['/root/a.ts'], options: { strict: true } });
    expect(mockSys.fileExists).toHaveBeenCalledWith('/root/a.ts');
    expect(mockSys.readDirectory).toHaveBeenCalledWith('/root', ['.ts'], [], ['**/*'], 1);
    expect(mockSys.readFile).toHaveBeenCalledWith('/root/tsconfig.json');
    expect(mockSys.getCurrentDirectory).toHaveBeenCalled();
  });

  it('should throw via onUnRecoverableConfigFileDiagnostic when the host reports a fatal config error', () => {
    const diagnostic = createDiagnostic({ category: DiagnosticCategory.Error, fileName: '/root/tsconfig.json' });
    mockFormatDiagnostic.mockReturnValue('unrecoverable config error');
    mockGetParsedCommandLineOfConfigFile.mockImplementation((_configFileName, _optionsToExtend, host) => {
      host.onUnRecoverableConfigFileDiagnostic(diagnostic);
      return undefined;
    });

    expect(() => parseTsConfig('/root/tsconfig.json')).toThrow('unrecoverable config error');
    expect(mockFormatDiagnostic).toHaveBeenCalledWith(diagnostic, expect.anything());
  });

  it('should throw when the config cannot be parsed', () => {
    mockGetParsedCommandLineOfConfigFile.mockReturnValue(undefined);

    expect(() => parseTsConfig('/root/tsconfig.json')).toThrow('Failed to parse TypeScript config: /root/tsconfig.json');
  });

  it('should throw when the parsed config contains errors', () => {
    const diagnostic = createDiagnostic({ category: DiagnosticCategory.Error, fileName: '/root/tsconfig.json' });
    mockFormatDiagnostics.mockReturnValue('config-errors');
    mockGetParsedCommandLineOfConfigFile.mockReturnValue(strictProxy<ParsedCommandLine>({
      errors: [diagnostic],
      fileNames: [],
      options: {}
    }));

    expect(() => parseTsConfig('/root/tsconfig.json')).toThrow('Errors while parsing TypeScript config /root/tsconfig.json:\nconfig-errors');
  });
});

interface CreateDiagnosticParams {
  readonly category: DiagnosticCategory;
  readonly fileName?: string;
}

function createDiagnostic(params: CreateDiagnosticParams): Diagnostic {
  return strictProxy<Diagnostic>({
    category: params.category,
    file: params.fileName === undefined ? undefined : strictProxy<SourceFile>({ fileName: params.fileName })
  });
}
