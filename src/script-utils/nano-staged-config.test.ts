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

const { mockExistsSync, mockExit, mockLoadEnvFile, mockStdoutWrite } = vi.hoisted(() => ({
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockExit: vi.fn(),
  mockLoadEnvFile: vi.fn(),
  mockStdoutWrite: vi.fn()
}));

vi.mock('node:fs', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:fs')>(),
  existsSync: mockExistsSync
}));

vi.mock('node:process', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:process')>();
  return {
    ...mod,
    default: {
      ...mod,
      exit: mockExit,
      loadEnvFile: mockLoadEnvFile,
      stdout: {
        ...mod.stdout,
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
