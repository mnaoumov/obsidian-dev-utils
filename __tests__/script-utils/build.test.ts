import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  buildClean,
  buildCompile,
  buildCompileSvelte,
  buildCompileTypeScript,
  buildStatic
} from '../../src/script-utils/build.ts';

const {
  mockCp,
  mockExecFromRoot,
  mockGlob,
  mockNpmRun,
  mockReaddirPosix,
  mockReadJson,
  mockResolvePathFromRootSafe,
  mockRm
} = vi.hoisted(() => ({
  mockCp: vi.fn(),
  mockExecFromRoot: vi.fn(),
  mockGlob: vi.fn(),
  mockNpmRun: vi.fn(),
  mockReaddirPosix: vi.fn(),
  mockReadJson: vi.fn(),
  mockResolvePathFromRootSafe: vi.fn<(path: string) => string>(),
  mockRm: vi.fn()
}));

vi.mock('../../src/script-utils/root.ts', () => ({
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

vi.mock('../../src/script-utils/npm-run.ts', () => ({
  npmRun: mockNpmRun
}));

vi.mock('../../src/script-utils/json.ts', () => ({
  readJson: mockReadJson
}));

vi.mock('../../src/script-utils/fs.ts', () => ({
  readdirPosix: mockReaddirPosix
}));

vi.mock('../../src/debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
  mockNpmRun.mockResolvedValue(undefined);
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
    expect(mockNpmRun).toHaveBeenCalledWith('build:compile:svelte');
    expect(mockNpmRun).toHaveBeenCalledWith('build:compile:typescript');
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
