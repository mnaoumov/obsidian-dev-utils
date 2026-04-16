import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noopAsync } from '../function.ts';
import {
  buildClean,
  buildCompile,
  buildCompileSvelte,
  buildCompileTypeScript,
  buildStatic
} from './build.ts';

const {
  mockCp,
  mockExecFromRoot,
  mockGlob,
  mockNpmRunOptional,
  mockReaddirPosix,
  mockReadJson,
  mockResolvePathFromRootSafe,
  mockRm
} = vi.hoisted(() => ({
  mockCp: vi.fn(),
  mockExecFromRoot: vi.fn(),
  mockGlob: vi.fn(),
  mockNpmRunOptional: vi.fn(),
  mockReaddirPosix: vi.fn(),
  mockReadJson: vi.fn(),
  mockResolvePathFromRootSafe: vi.fn<(path: string) => string>(),
  mockRm: vi.fn()
}));

vi.mock('../script-utils/root.ts', () => ({
  execFromRoot: mockExecFromRoot,
  resolvePathFromRootSafe: mockResolvePathFromRootSafe
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...mod,
    cp: mockCp,
    glob: mockGlob,
    rm: mockRm
  };
});

vi.mock('../script-utils/npm-run.ts', () => ({
  npmRunOptional: mockNpmRunOptional
}));

vi.mock('../script-utils/json.ts', () => ({
  readJson: mockReadJson
}));

vi.mock('../script-utils/fs.ts', () => ({
  readdirPosix: mockReaddirPosix
}));

vi.mock('../debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
  mockNpmRunOptional.mockResolvedValue(true);
  mockRm.mockResolvedValue(undefined);
  mockCp.mockResolvedValue(undefined);
  mockResolvePathFromRootSafe.mockImplementation((path: string) => `/root/${path}`);
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

  it('should fall back to internal implementations when npmRunOptional returns false', async () => {
    mockNpmRunOptional.mockResolvedValue(false);
    mockReadJson.mockResolvedValue({ include: ['src/**/*.ts'] });
    mockGlob.mockReturnValue((async function* generateTsFiles(): AsyncGenerator<string, void> {
      await noopAsync();
      yield 'src/main.ts';
    })());
    await buildCompile();
    expect(mockNpmRunOptional).toHaveBeenCalledWith('build:compile:svelte');
    expect(mockNpmRunOptional).toHaveBeenCalledWith('build:compile:typescript');
    expect(mockExecFromRoot).toHaveBeenCalledWith(['npx', 'tsc', '--build', '--force']);
  });
});

describe('buildCompileTypeScript', () => {
  it('should run tsc --build --force', async () => {
    await buildCompileTypeScript();
    expect(mockExecFromRoot).toHaveBeenCalledWith(['npx', 'tsc', '--build', '--force']);
  });
});

describe('buildCompileSvelte', () => {
  it('should skip when no svelte files found', async () => {
    mockReadJson.mockResolvedValue({ include: ['src/**/*.ts'] });
    mockGlob.mockReturnValue((async function* generateTsFiles(): AsyncGenerator<string, void> {
      await noopAsync();
      yield 'src/main.ts';
    })());
    await buildCompileSvelte();
    expect(mockExecFromRoot).not.toHaveBeenCalled();
  });

  it('should handle missing include and exclude in tsconfig', async () => {
    mockReadJson.mockResolvedValue({});
    mockGlob.mockReturnValue((async function* generateEmpty(): AsyncGenerator<string, void> {
      // Empty generator
    })());
    await buildCompileSvelte();
    expect(mockExecFromRoot).not.toHaveBeenCalled();
  });

  it('should run svelte-check when svelte files exist', async () => {
    mockReadJson.mockResolvedValue({ exclude: ['node_modules/**'], include: ['src/**/*'] });
    mockGlob.mockReturnValue((async function* generateSvelteFiles(): AsyncGenerator<string, void> {
      await noopAsync();
      yield 'src/Component.svelte';
    })());
    await buildCompileSvelte();
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['npx', 'svelte-check'])
    );
  });
});

describe('buildStatic', () => {
  it('should copy static files to dist folder', async () => {
    mockReaddirPosix.mockResolvedValue([
      { isFile: (): boolean => true, name: 'style.css', parentPath: 'static' }
    ]);
    await buildStatic();
    expect(mockCp).toHaveBeenCalledTimes(1);
  });

  it('should skip directories', async () => {
    mockReaddirPosix.mockResolvedValue([
      { isFile: (): boolean => false, name: 'subdir', parentPath: 'static' }
    ]);
    await buildStatic();
    expect(mockCp).not.toHaveBeenCalled();
  });
});
