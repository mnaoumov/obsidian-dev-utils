import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  addGitTag,
  addUpdatedFilesToGit,
  checkGitHubCliInstalled,
  checkGitInstalled,
  checkGitRepoClean,
  copyUpdatedManifest,
  getNewVersion,
  getVersionUpdateType,
  gitPush,
  updateVersionInFiles,
  validate,
  VersionUpdateType
} from '../../src/ScriptUtils/version.ts';

const {
  mockCp,
  mockEditNpmShrinkWrapJson,
  mockEditPackageJson,
  mockEditPackageLockJson,
  mockExecFromRoot,
  mockReadPackageJson,
  mockResolvePathFromRootSafe
} = vi.hoisted(() => ({
  mockCp: vi.fn(),
  mockEditNpmShrinkWrapJson: vi.fn(),
  mockEditPackageJson: vi.fn(),
  mockEditPackageLockJson: vi.fn(),
  mockExecFromRoot: vi.fn(),
  mockReadPackageJson: vi.fn(),
  mockResolvePathFromRootSafe: vi.fn<(path: string) => string>()
}));

vi.mock('../../src/ScriptUtils/Npm.ts', () => ({
  editNpmShrinkWrapJson: mockEditNpmShrinkWrapJson,
  editPackageJson: mockEditPackageJson,
  editPackageLockJson: mockEditPackageLockJson,
  readPackageJson: mockReadPackageJson
}));

vi.mock('../../src/ScriptUtils/Root.ts', () => ({
  execFromRoot: mockExecFromRoot,
  resolvePathFromRootSafe: mockResolvePathFromRootSafe
}));

vi.mock('../../src/ScriptUtils/NodeModules.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/ScriptUtils/NodeModules.ts')>();
  return {
    ...mod,
    cp: mockCp
  };
});

vi.mock('../../src/Debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
  mockEditPackageJson.mockResolvedValue(undefined);
  mockEditPackageLockJson.mockResolvedValue(undefined);
  mockEditNpmShrinkWrapJson.mockResolvedValue(undefined);
  mockCp.mockResolvedValue(undefined);
  mockResolvePathFromRootSafe.mockImplementation((path: string) => `/root/${path}`);
});

describe('VersionUpdateType', () => {
  it('should have Major equal to "major"', () => {
    expect(VersionUpdateType.Major).toBe('major');
  });

  it('should have Minor equal to "minor"', () => {
    expect(VersionUpdateType.Minor).toBe('minor');
  });

  it('should have Patch equal to "patch"', () => {
    expect(VersionUpdateType.Patch).toBe('patch');
  });

  it('should have Beta equal to "beta"', () => {
    expect(VersionUpdateType.Beta).toBe('beta');
  });

  it('should have Manual equal to "manual"', () => {
    expect(VersionUpdateType.Manual).toBe('manual');
  });

  it('should have Invalid equal to "invalid"', () => {
    expect(VersionUpdateType.Invalid).toBe('invalid');
  });
});

describe('getVersionUpdateType', () => {
  it.each([
    ['major', VersionUpdateType.Major],
    ['minor', VersionUpdateType.Minor],
    ['patch', VersionUpdateType.Patch],
    ['beta', VersionUpdateType.Beta],
    ['1.2.3', VersionUpdateType.Manual],
    ['1.2.3-beta.1', VersionUpdateType.Manual],
    ['0.0.1', VersionUpdateType.Manual],
    ['invalid', VersionUpdateType.Invalid],
    ['abc', VersionUpdateType.Invalid],
    ['', VersionUpdateType.Invalid],
    ['1.2', VersionUpdateType.Invalid]
  ])('should return %j for input %j', (input: string, expected: VersionUpdateType) => {
    expect(getVersionUpdateType(input)).toBe(expected);
  });
});

describe('validate', () => {
  it.each([
    ['major'],
    ['minor'],
    ['patch'],
    ['beta'],
    ['1.2.3']
  ])('should not throw for valid input %j', (input: string) => {
    expect(() => {
      validate(input);
    }).not.toThrow();
  });

  it.each([
    ['invalid'],
    ['abc'],
    ['']
  ])('should throw for invalid input %j', (input: string) => {
    expect(() => {
      validate(input);
    }).toThrow();
  });
});

describe('getNewVersion', () => {
  it('should return manual version as-is without reading package.json', async () => {
    const result = await getNewVersion('2.0.0');
    expect(result).toBe('2.0.0');
    expect(mockReadPackageJson).not.toHaveBeenCalled();
  });

  it('should bump major version', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.3' });
    const result = await getNewVersion('major');
    expect(result).toBe('2.0.0');
  });

  it('should bump minor version', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.3' });
    const result = await getNewVersion('minor');
    expect(result).toBe('1.3.0');
  });

  it('should bump patch version', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.3' });
    const result = await getNewVersion('patch');
    expect(result).toBe('1.2.4');
  });

  it('should create first beta from non-beta version', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.3' });
    const result = await getNewVersion('beta');
    expect(result).toBe('1.2.4-beta.1');
  });

  it('should increment beta from existing beta version', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.4-beta.1' });
    const result = await getNewVersion('beta');
    expect(result).toBe('1.2.4-beta.2');
  });

  it('should promote beta to release on patch bump', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.4-beta.2' });
    const result = await getNewVersion('patch');
    expect(result).toBe('1.2.4');
  });

  it('should reset beta on major bump', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.4-beta.2' });
    const result = await getNewVersion('major');
    expect(result).toBe('2.0.0');
  });

  it('should reset beta on minor bump', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.4-beta.2' });
    const result = await getNewVersion('minor');
    expect(result).toBe('1.3.0');
  });

  it('should throw for invalid current version format', async () => {
    mockReadPackageJson.mockResolvedValue({ version: 'invalid' });
    await expect(getNewVersion('patch')).rejects.toThrow('Invalid current version format');
  });

  it('should handle missing version in package.json', async () => {
    mockReadPackageJson.mockResolvedValue({});
    await expect(getNewVersion('patch')).rejects.toThrow('Invalid current version format');
  });
});

describe('checkGitInstalled', () => {
  it('should not throw when git is installed', async () => {
    mockExecFromRoot.mockResolvedValue('git version 2.40.0');
    await expect(checkGitInstalled()).resolves.toBeUndefined();
  });

  it('should throw when git is not installed', async () => {
    mockExecFromRoot.mockRejectedValue(new Error('command not found'));
    await expect(checkGitInstalled()).rejects.toThrow('Git is not installed');
  });
});

describe('checkGitHubCliInstalled', () => {
  it('should not throw when gh is installed', async () => {
    mockExecFromRoot.mockResolvedValue('gh version 2.30.0');
    await expect(checkGitHubCliInstalled()).resolves.toBeUndefined();
  });

  it('should throw when gh is not installed', async () => {
    mockExecFromRoot.mockRejectedValue(new Error('command not found'));
    await expect(checkGitHubCliInstalled()).rejects.toThrow('GitHub CLI is not installed');
  });
});

describe('checkGitRepoClean', () => {
  it('should not throw when repo is clean', async () => {
    mockExecFromRoot.mockResolvedValue('');
    await expect(checkGitRepoClean()).resolves.toBeUndefined();
  });

  it('should throw when repo has uncommitted changes', async () => {
    mockExecFromRoot.mockResolvedValue('M src/file.ts');
    await expect(checkGitRepoClean()).rejects.toThrow('Git repository is not clean');
  });

  it('should throw when git status command fails', async () => {
    mockExecFromRoot.mockRejectedValue(new Error('not a git repo'));
    await expect(checkGitRepoClean()).rejects.toThrow('Git repository is not clean');
  });
});

describe('addGitTag', () => {
  it('should execute git tag command with version', async () => {
    await addGitTag('1.0.0');
    expect(mockExecFromRoot).toHaveBeenCalledWith('git tag -a 1.0.0 -m 1.0.0 --force', { isQuiet: true });
  });
});

describe('addUpdatedFilesToGit', () => {
  it('should stage all files and commit with version message', async () => {
    await addUpdatedFilesToGit('1.0.0');
    expect(mockExecFromRoot).toHaveBeenCalledWith(['git', 'add', '--all'], { isQuiet: true });
    expect(mockExecFromRoot).toHaveBeenCalledWith(['git', 'commit', '-m', 'chore: release 1.0.0', '--allow-empty'], { isQuiet: true });
  });
});

describe('gitPush', () => {
  it('should push with follow-tags and force', async () => {
    await gitPush();
    expect(mockExecFromRoot).toHaveBeenCalledWith('git push --follow-tags --force', { isQuiet: true });
  });
});

describe('updateVersionInFiles', () => {
  it('should update version in package.json', async () => {
    await updateVersionInFiles('2.0.0');
    expect(mockEditPackageJson).toHaveBeenCalledTimes(1);
    const editFn = mockEditPackageJson.mock.calls[0]?.[0] as (pkg: Record<string, string>) => void;
    const pkg: Record<string, string> = { version: '1.0.0' };
    editFn(pkg);
    expect(pkg['version']).toBe('2.0.0');
  });

  it('should update version in package-lock.json with shouldSkipIfMissing', async () => {
    await updateVersionInFiles('2.0.0');
    expect(mockEditPackageLockJson).toHaveBeenCalledWith(expect.any(Function), { shouldSkipIfMissing: true });
  });

  it('should update version in npm-shrinkwrap.json with shouldSkipIfMissing', async () => {
    await updateVersionInFiles('2.0.0');
    expect(mockEditNpmShrinkWrapJson).toHaveBeenCalledWith(expect.any(Function), { shouldSkipIfMissing: true });
  });

  it('should update version and packages default entry in lock file', async () => {
    await updateVersionInFiles('3.0.0');
    const updateFn = mockEditPackageLockJson.mock.calls[0]?.[0] as (lock: Record<string, unknown>) => void;
    const lockJson: Record<string, unknown> = { packages: { '': { version: '1.0.0' } }, version: '1.0.0' };
    updateFn(lockJson);
    expect(lockJson['version']).toBe('3.0.0');
    expect((lockJson['packages'] as Record<string, Record<string, string>>)['']?.['version']).toBe('3.0.0');
  });
});

describe('copyUpdatedManifest', () => {
  it('should copy manifest.json to dist/build folder', async () => {
    await copyUpdatedManifest();
    expect(mockCp).toHaveBeenCalledTimes(1);
    expect(mockCp).toHaveBeenCalledWith(
      expect.stringContaining('manifest.json'),
      expect.stringContaining('manifest.json'),
      { force: true }
    );
  });
});
