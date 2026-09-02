import type { PackageJson } from 'type-fest';

import {
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
import type { ResolveToolCommandParams } from './package-manager.ts';
import type { ResolvePathFromRootSafeParams } from './root.ts';

import { noopAsync } from '../function.ts';
import {
  buildClean,
  buildCompile,
  buildCompileSvelte,
  buildCompileTypeScript,
  buildTemplates
} from './build.ts';
import { NpmRunOptionalResult } from './npm-run.ts';

const {
  mockCheckProjectTypes,
  mockCp,
  mockExecFromRoot,
  mockGetRootFolder,
  mockGlob,
  mockNpmRunOptional,
  mockParseTsConfig,
  mockReaddirPosix,
  mockReadJson,
  mockReadPackageJson,
  mockResolvePathFromRootSafe,
  mockResolveToolCommand,
  mockRm,
  mockToCanonical
} = vi.hoisted(() => ({
  mockCheckProjectTypes: vi.fn<(params: CheckProjectTypesParams) => boolean>(),
  mockCp: vi.fn(),
  mockExecFromRoot: vi.fn(),
  mockGetRootFolder: vi.fn<() => null | string>(),
  mockGlob: vi.fn(),
  mockNpmRunOptional: vi.fn(),
  mockParseTsConfig: vi.fn<(tsConfigPath: string) => ParsedTsConfig>(),
  mockReaddirPosix: vi.fn(),
  mockReadJson: vi.fn(),
  mockReadPackageJson: vi.fn<() => Promise<PackageJson>>(),
  mockResolvePathFromRootSafe: vi.fn<(params: ResolvePathFromRootSafeParams) => string>(),
  mockResolveToolCommand: vi.fn<(params: ResolveToolCommandParams) => string[]>(),
  mockRm: vi.fn(),
  mockToCanonical: vi.fn<(fileName: string) => string>()
}));

vi.mock('../script-utils/root.ts', () => ({
  execFromRoot: mockExecFromRoot,
  getRootFolder: mockGetRootFolder,
  resolvePathFromRootSafe: mockResolvePathFromRootSafe
}));

vi.mock('../script-utils/package-manager.ts', () => ({
  resolveToolCommand: mockResolveToolCommand
}));

vi.mock('./check-project-types.ts', () => ({
  checkProjectTypes: mockCheckProjectTypes,
  parseTsConfig: mockParseTsConfig,
  toCanonical: mockToCanonical
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const $module = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...$module,
    cp: mockCp,
    glob: mockGlob,
    rm: mockRm
  };
});

vi.mock('../script-utils/npm-run.ts', async (importOriginal) => {
  const $module = await importOriginal<typeof import('./npm-run.ts')>();
  return {
    ...$module,
    npmRunOptional: mockNpmRunOptional
  };
});

vi.mock('../script-utils/json.ts', () => ({
  readJson: mockReadJson
}));

vi.mock('../script-utils/fs.ts', () => ({
  readdirPosix: mockReaddirPosix
}));

vi.mock('../script-utils/npm.ts', () => ({
  readPackageJson: mockReadPackageJson
}));

vi.mock('../debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
  mockNpmRunOptional.mockResolvedValue(NpmRunOptionalResult.Success);
  mockRm.mockResolvedValue(undefined);
  mockCp.mockResolvedValue(undefined);
  mockResolvePathFromRootSafe.mockImplementation((params: ResolvePathFromRootSafeParams) => `/root/${params.path}`);
  mockResolveToolCommand.mockImplementation((params: ResolveToolCommandParams) => [params.tool]);
  mockGetRootFolder.mockReturnValue('/root');
  mockToCanonical.mockImplementation((fileName: string) => fileName.toLowerCase());
  mockParseTsConfig.mockReturnValue({ fileNames: ['/root/src/a.ts'], options: {} });
  mockCheckProjectTypes.mockReturnValue(true);
  mockReadPackageJson.mockResolvedValue({ devDependencies: { 'svelte-check': '^4.0.0' } });
});

describe('buildClean', () => {
  it('should remove the dist folder', async () => {
    await buildClean();
    expect(mockRm).toHaveBeenCalledWith('dist', { force: true, recursive: true });
  });
});

describe('buildCompile', () => {
  it('should run svelte and typescript compile steps', async () => {
    await buildCompile();
    expect(mockNpmRunOptional).toHaveBeenCalledWith('build:compile:svelte');
    expect(mockNpmRunOptional).toHaveBeenCalledWith('build:compile:typescript');
  });

  it('should fall back to internal implementations when npmRunOptional skips', async () => {
    mockNpmRunOptional.mockResolvedValue(NpmRunOptionalResult.Skipped);
    mockReadJson.mockResolvedValue({ include: ['src/**/*.ts'] });
    mockGlob.mockReturnValue((async function* generateTsFiles(): AsyncGenerator<string, void> {
      await noopAsync();
      yield 'src/main.ts';
    })());
    await buildCompile();
    expect(mockNpmRunOptional).toHaveBeenCalledWith('build:compile:svelte');
    expect(mockNpmRunOptional).toHaveBeenCalledWith('build:compile:typescript');
    expect(mockExecFromRoot).toHaveBeenCalledWith(['tsc', '--build', '--force']);
  });
});

describe('buildCompileTypeScript', () => {
  it('should run tsc --build --force and validate the project types', async () => {
    await buildCompileTypeScript();
    expect(mockExecFromRoot).toHaveBeenCalledWith(['tsc', '--build', '--force']);
    expect(mockParseTsConfig).toHaveBeenCalledWith('/root/tsconfig.json');
    expect(mockCheckProjectTypes).toHaveBeenCalledWith(expect.objectContaining({
      options: {},
      rootNames: ['/root/src/a.ts']
    }));
  });

  it('should keep only project files outside node_modules when validating', async () => {
    mockCheckProjectTypes.mockImplementation((params) => {
      expect(params.shouldKeepFile('/root/src/a.ts')).toBe(true);
      expect(params.shouldKeepFile('/root/node_modules/obsidian/obsidian.d.ts')).toBe(false);
      expect(params.shouldKeepFile('/other/z.ts')).toBe(false);
      return true;
    });

    await buildCompileTypeScript();
    expect(mockCheckProjectTypes).toHaveBeenCalledTimes(1);
  });

  it('should throw when the project types fail validation', async () => {
    mockCheckProjectTypes.mockReturnValue(false);
    await expect(buildCompileTypeScript()).rejects.toThrow('TypeScript declaration validation failed.');
  });

  it('should throw when the root folder cannot be found', async () => {
    mockGetRootFolder.mockReturnValue(null);
    await expect(buildCompileTypeScript()).rejects.toThrow('Could not find root folder');
  });
});

describe('buildCompileSvelte', () => {
  function mockGlobResult(...files: string[]): void {
    mockGlob.mockReturnValue((async function* generateFiles(): AsyncGenerator<string, void> {
      await noopAsync();
      yield* files;
    })());
  }

  it('should glob svelte extensions rather than the tsconfig include patterns', async () => {
    mockReadJson.mockResolvedValue({ include: ['./src/**/*.ts', './scripts/**/*.ts'] });
    mockGlobResult();
    await buildCompileSvelte();
    expect(mockGlob).toHaveBeenCalledWith(
      ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts'],
      expect.anything()
    );
  });

  it('should exclude node_modules and dist on top of the tsconfig exclude patterns', async () => {
    mockReadJson.mockResolvedValue({ exclude: ['./scripts/docs-gen/**/*.ts'], include: ['./src/**/*.ts'] });
    mockGlobResult();
    await buildCompileSvelte();
    expect(mockGlob).toHaveBeenCalledWith(
      expect.anything(),
      { cwd: '/root/.', exclude: ['**/node_modules/**', '**/dist/**', './scripts/docs-gen/**/*.ts'] }
    );
  });

  it('should skip when no svelte files found', async () => {
    mockReadJson.mockResolvedValue({ include: ['./src/**/*.ts'] });
    mockGlobResult();
    await buildCompileSvelte();
    expect(mockExecFromRoot).not.toHaveBeenCalled();
  });

  it('should handle missing exclude in tsconfig', async () => {
    mockReadJson.mockResolvedValue({});
    mockGlobResult();
    await buildCompileSvelte();
    expect(mockGlob).toHaveBeenCalledWith(
      expect.anything(),
      { cwd: '/root/.', exclude: ['**/node_modules/**', '**/dist/**'] }
    );
  });

  it('should run svelte-check when svelte files exist', async () => {
    mockReadJson.mockResolvedValue({ include: ['./src/**/*.ts'] });
    mockGlobResult('src/svelte-components/sample-svelte-component.svelte');
    await buildCompileSvelte();
    expect(mockExecFromRoot).toHaveBeenCalledWith(['svelte-check', '--tsconfig', 'tsconfig.json']);
  });

  it('should run svelte-check when svelte-check is declared as a regular dependency', async () => {
    mockReadJson.mockResolvedValue({ include: ['./src/**/*.ts'] });
    mockGlobResult('src/Component.svelte');
    mockReadPackageJson.mockResolvedValue({ dependencies: { 'svelte-check': '^4.0.0' } });
    await buildCompileSvelte();
    expect(mockExecFromRoot).toHaveBeenCalledWith(['svelte-check', '--tsconfig', 'tsconfig.json']);
  });

  it('should run svelte-check when svelte-check is declared as a peer dependency', async () => {
    mockReadJson.mockResolvedValue({ include: ['./src/**/*.ts'] });
    mockGlobResult('src/Component.svelte');
    mockReadPackageJson.mockResolvedValue({ peerDependencies: { 'svelte-check': '^4.0.0' } });
    await buildCompileSvelte();
    expect(mockExecFromRoot).toHaveBeenCalledWith(['svelte-check', '--tsconfig', 'tsconfig.json']);
  });

  it('should throw when svelte files exist but svelte-check is not declared', async () => {
    mockReadJson.mockResolvedValue({ include: ['./src/**/*.ts'] });
    mockGlobResult('src/Component.svelte');
    mockReadPackageJson.mockResolvedValue({ devDependencies: { svelte: '^5.0.0' } });
    await expect(buildCompileSvelte()).rejects.toThrow(
      'Found Svelte file(s) in the project (e.g. src/Component.svelte), but `svelte-check` is not declared in package.json. Add `svelte-check` as a devDependency to type-check the Svelte code.'
    );
    expect(mockExecFromRoot).not.toHaveBeenCalled();
  });

  it('should not read package.json when there are no svelte files', async () => {
    mockReadJson.mockResolvedValue({ include: ['./src/**/*.ts'] });
    mockGlobResult();
    await buildCompileSvelte();
    expect(mockReadPackageJson).not.toHaveBeenCalled();
  });
});

describe('buildTemplates', () => {
  it('should copy template files to the dist/templates folder', async () => {
    mockReaddirPosix.mockResolvedValue([
      { isFile: (): boolean => true, name: 'style.css', parentPath: 'templates' }
    ]);
    await buildTemplates();
    expect(mockCp).toHaveBeenCalledTimes(1);
    expect(mockCp).toHaveBeenCalledWith('templates/style.css', 'dist/templates/style.css');
  });

  it('should strip the .template suffix from the destination file name', async () => {
    mockReaddirPosix.mockResolvedValue([
      { isFile: (): boolean => true, name: 'eslint.config.mts.template', parentPath: 'templates' }
    ]);
    await buildTemplates();
    expect(mockCp).toHaveBeenCalledTimes(1);
    expect(mockCp).toHaveBeenCalledWith('templates/eslint.config.mts.template', 'dist/templates/eslint.config.mts');
  });

  it('should skip directories', async () => {
    mockReaddirPosix.mockResolvedValue([
      { isFile: (): boolean => false, name: 'subdir', parentPath: 'templates' }
    ]);
    await buildTemplates();
    expect(mockCp).not.toHaveBeenCalled();
  });
});
