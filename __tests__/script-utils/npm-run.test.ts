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
} from '../../src/script-utils/npm-run.ts';

const {
  mockExecFromRoot,
  mockReadPackageJson
} = vi.hoisted(() => ({
  mockExecFromRoot: vi.fn(),
  mockReadPackageJson: vi.fn()
}));

vi.mock('../../src/script-utils/npm.ts', () => ({
  readPackageJson: mockReadPackageJson
}));

vi.mock('../../src/script-utils/root.ts', () => ({
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

  it('should run npx when command does not exist in package.json', async () => {
    mockReadPackageJson.mockResolvedValue({ scripts: { build: 'tsc' } });
    await npmRun('lint');
    expect(mockExecFromRoot).toHaveBeenCalledWith(['npx', 'obsidian-dev-utils', 'lint']);
  });

  it('should handle missing scripts section in package.json', async () => {
    mockReadPackageJson.mockResolvedValue({});
    await npmRun('build');
    expect(mockExecFromRoot).toHaveBeenCalledWith(['npx', 'obsidian-dev-utils', 'build']);
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
