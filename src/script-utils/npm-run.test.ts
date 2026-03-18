import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  npmRun,
  npmRunOptional
} from './npm-run.ts';

const {
  mockExecFromRoot,
  mockReadPackageJson
} = vi.hoisted(() => ({
  mockExecFromRoot: vi.fn(),
  mockReadPackageJson: vi.fn()
}));

vi.mock('../script-utils/npm.ts', () => ({
  readPackageJson: mockReadPackageJson
}));

vi.mock('../script-utils/root.ts', () => ({
  execFromRoot: mockExecFromRoot
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
});

describe('npmRun', () => {
  it('should run npm script when command exists in package.json', async () => {
    mockReadPackageJson.mockResolvedValue({ scripts: { build: 'tsc' } });
    await npmRun('build');
    expect(mockExecFromRoot).toHaveBeenCalledWith(['npm', 'run', 'build']);
  });

  it('should throw when command does not exist in package.json', async () => {
    mockReadPackageJson.mockResolvedValue({ scripts: { build: 'tsc' } });
    await expect(npmRun('lint')).rejects.toThrow('Command lint is not defined in the package.json');
    expect(mockExecFromRoot).not.toHaveBeenCalled();
  });

  it('should throw when scripts section is missing in package.json', async () => {
    mockReadPackageJson.mockResolvedValue({});
    await expect(npmRun('build')).rejects.toThrow('Command build is not defined in the package.json');
    expect(mockExecFromRoot).not.toHaveBeenCalled();
  });
});

describe('npmRunOptional', () => {
  it('should run npm script when command exists in package.json', async () => {
    mockReadPackageJson.mockResolvedValue({ scripts: { test: 'vitest' } });
    await npmRunOptional('test');
    expect(mockExecFromRoot).toHaveBeenCalledWith(['npm', 'run', 'test']);
  });

  it('should skip when command does not exist in package.json', async () => {
    mockReadPackageJson.mockResolvedValue({ scripts: { test: 'vitest' } });
    await npmRunOptional('unknown');
    expect(mockExecFromRoot).not.toHaveBeenCalled();
  });

  it('should handle missing scripts section in package.json', async () => {
    mockReadPackageJson.mockResolvedValue({});
    await npmRunOptional('build');
    expect(mockExecFromRoot).not.toHaveBeenCalled();
  });
});
