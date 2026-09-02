import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  getNanoStagedConfig,
  obsidianDevUtilsConfig
} from './nano-staged-config.ts';

const { mockExistsSync, mockExit, mockGetPackageManagerRunCommand, mockLoadEnvFile, mockStdoutWrite } = vi.hoisted(() => ({
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockExit: vi.fn(),
  /*
   * The run prefix is resolved at MODULE SCOPE, before any `beforeEach` runs, so the default
   * implementation has to be supplied here rather than in a hook. Without it the config's contents would
   * depend on whichever package manager launched vitest.
   */
  mockGetPackageManagerRunCommand: vi.fn<() => string[]>(() => ['npm', 'run']),
  mockLoadEnvFile: vi.fn(),
  mockStdoutWrite: vi.fn()
}));

vi.mock('./package-manager.ts', () => ({
  getPackageManagerRunCommand: mockGetPackageManagerRunCommand
}));

vi.mock('node:fs', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:fs')>(),
  existsSync: mockExistsSync
}));

vi.mock('node:process', async (importOriginal) => {
  const $module = await importOriginal<typeof import('node:process')>();
  return {
    ...$module,
    default: {
      ...$module,
      exit: mockExit,
      loadEnvFile: mockLoadEnvFile,
      stdout: {
        ...$module.stdout,
        write: mockStdoutWrite
      }
    }
  };
});

describe('getNanoStagedConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    vi.stubEnv('NANO_STAGED', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return the shared config when NANO_STAGED is unset', () => {
    vi.stubEnv('NANO_STAGED', undefined);
    expect(getNanoStagedConfig()).toBe(obsidianDevUtilsConfig);
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should run when NANO_STAGED is an on value', () => {
    vi.stubEnv('NANO_STAGED', '1');
    expect(getNanoStagedConfig()).toBe(obsidianDevUtilsConfig);
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should load .env when it exists', () => {
    mockExistsSync.mockReturnValue(true);
    getNanoStagedConfig();
    expect(mockLoadEnvFile).toHaveBeenCalledWith('.env');
  });

  it('should not load .env when it is absent', () => {
    mockExistsSync.mockReturnValue(false);
    getNanoStagedConfig();
    expect(mockLoadEnvFile).not.toHaveBeenCalled();
  });

  it.each(['0', 'false', 'OFF', ' no '])('should skip and exit 0 when NANO_STAGED is %s', (value) => {
    vi.stubEnv('NANO_STAGED', value);
    getNanoStagedConfig();
    expect(mockStdoutWrite).toHaveBeenCalledWith('nano-staged: skipped (NANO_STAGED is off).\n');
    expect(mockExit).toHaveBeenCalledWith(0);
  });
});

describe('obsidianDevUtilsConfig', () => {
  it('should run every task through npm when npm owns the tree', () => {
    expect(obsidianDevUtilsConfig).toEqual({
      '!(templates)*.{ts,tsx,mts}': ['npm run lint:fix --'],
      '*': ['npm run spellcheck --'],
      '*.{ts,tsx,mts}': ['npm run format --'],
      '*.md': ['npm run lint:md:fix --']
    });
  });

  it('should run every task through the package manager that owns the tree', async () => {
    /*
     * The prefix is baked in when the module is evaluated, so the manager can only be changed by
     * re-evaluating it. `mockReturnValueOnce` is consumed by that single re-evaluation and restores the
     * npm default on its own, leaving nothing to undo for the tests that follow.
     */
    mockGetPackageManagerRunCommand.mockReturnValueOnce(['bun', 'run']);
    vi.resetModules();

    const { obsidianDevUtilsConfig: bunConfig } = await import('./nano-staged-config.ts');

    expect(bunConfig).toEqual({
      '!(templates)*.{ts,tsx,mts}': ['bun run lint:fix --'],
      '*': ['bun run spellcheck --'],
      '*.{ts,tsx,mts}': ['bun run format --'],
      '*.md': ['bun run lint:md:fix --']
    });
  });
});
