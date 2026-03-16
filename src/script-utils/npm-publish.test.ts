import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from '../object-utils.ts';
import { publish } from './npm-publish.ts';

const {
  mockExecFromRoot,
  mockExistsSync,
  mockLoadEnvFile,
  mockProcess,
  mockResolvePathFromRoot
} = vi.hoisted(() => ({
  mockExecFromRoot: vi.fn(),
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockLoadEnvFile: vi.fn(),
  mockProcess: { env: castTo<Record<string, string | undefined>>({}) },
  mockResolvePathFromRoot: vi.fn<(path: string) => null | string>()
}));

vi.mock('../script-utils/root.ts', () => ({
  execFromRoot: mockExecFromRoot,
  resolvePathFromRoot: mockResolvePathFromRoot
}));

vi.mock('node:fs', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:fs')>();
  return {
    ...mod,
    existsSync: mockExistsSync
  };
});

vi.mock('node:process', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:process')>();
  return {
    ...mod,
    default: mockProcess,
    loadEnvFile: mockLoadEnvFile
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
  mockProcess.env = {};
});

describe('publish', () => {
  it('should load .env file when it exists', async () => {
    mockResolvePathFromRoot.mockReturnValue('/root/.env');
    mockExistsSync.mockReturnValue(true);
    await publish();
    expect(mockLoadEnvFile).toHaveBeenCalledWith('/root/.env');
  });

  it('should not load .env file when path is null', async () => {
    mockResolvePathFromRoot.mockReturnValue(null);
    await publish();
    expect(mockLoadEnvFile).not.toHaveBeenCalled();
  });

  it('should not load .env file when it does not exist', async () => {
    mockResolvePathFromRoot.mockReturnValue('/root/.env');
    mockExistsSync.mockReturnValue(false);
    await publish();
    expect(mockLoadEnvFile).not.toHaveBeenCalled();
  });

  it('should set npm auth token and publish with latest tag', async () => {
    mockResolvePathFromRoot.mockReturnValue(null);
    mockProcess.env['NPM_TOKEN'] = 'test-token';
    await publish();
    expect(mockExecFromRoot).toHaveBeenCalledWith(['npm', 'config', 'set', '//registry.npmjs.org/:_authToken=test-token']);
    expect(mockExecFromRoot).toHaveBeenCalledWith(['npm', 'publish', '--tag', 'latest']);
  });

  it('should publish with beta tag when isBeta is true', async () => {
    mockResolvePathFromRoot.mockReturnValue(null);
    await publish(true);
    expect(mockExecFromRoot).toHaveBeenCalledWith(['npm', 'publish', '--tag', 'beta']);
  });

  it('should use empty string when NPM_TOKEN is not set', async () => {
    mockResolvePathFromRoot.mockReturnValue(null);
    await publish();
    expect(mockExecFromRoot).toHaveBeenCalledWith(['npm', 'config', 'set', '//registry.npmjs.org/:_authToken=']);
  });
});
