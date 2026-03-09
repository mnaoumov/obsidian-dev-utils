import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenericObject } from '../../src/type-guards.ts';

import {
  addGitTag,
  addUpdatedFilesToGit,
  checkGitHubCliInstalled,
  checkGitInstalled,
  checkGitRepoClean,
  copyUpdatedManifest,
  getNewVersion,
  getReleaseNotes,
  getVersionUpdateType,
  gitPush,
  publishGitHubRelease,
  updateChangelog,
  updateVersion,
  updateVersionInFiles,
  validate,
  version,
  VersionUpdateType
} from '../../src/script-utils/version.ts';

const {
  mockCp,
  mockCreateInterface,
  mockEditJson,
  mockEditNpmShrinkWrapJson,
  mockEditPackageJson,
  mockEditPackageLockJson,
  mockExecFromRoot,
  mockExistsSync,
  mockNpmRun,
  mockNpmRunOptional,
  mockReaddirPosix,
  mockReadFile,
  mockReadPackageJson,
  mockResolvePathFromRootSafe,
  mockRm,
  mockWriteFile
} = vi.hoisted(() => ({
  mockCp: vi.fn(),
  mockCreateInterface: vi.fn(),
  mockEditJson: vi.fn(),
  mockEditNpmShrinkWrapJson: vi.fn(),
  mockEditPackageJson: vi.fn(),
  mockEditPackageLockJson: vi.fn(),
  mockExecFromRoot: vi.fn(),
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockNpmRun: vi.fn(),
  mockNpmRunOptional: vi.fn(),
  mockReaddirPosix: vi.fn(),
  mockReadFile: vi.fn(),
  mockReadPackageJson: vi.fn(),
  mockResolvePathFromRootSafe: vi.fn<(path: string) => string>(),
  mockRm: vi.fn(),
  mockWriteFile: vi.fn()
}));

vi.mock('../../src/script-utils/npm.ts', () => ({
  editNpmShrinkWrapJson: mockEditNpmShrinkWrapJson,
  editPackageJson: mockEditPackageJson,
  editPackageLockJson: mockEditPackageLockJson,
  readPackageJson: mockReadPackageJson
}));

vi.mock('../../src/script-utils/root.ts', () => ({
  execFromRoot: mockExecFromRoot,
  resolvePathFromRootSafe: mockResolvePathFromRootSafe
}));

vi.mock('node:fs', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:fs')>();
  return {
    ...mod,
    existsSync: mockExistsSync
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...mod,
    cp: mockCp,
    readFile: mockReadFile,
    rm: mockRm,
    writeFile: mockWriteFile
  };
});

vi.mock('node:readline/promises', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:readline/promises')>();
  return {
    ...mod,
    createInterface: mockCreateInterface
  };
});

vi.mock('../../src/script-utils/fs.ts', () => ({
  readdirPosix: mockReaddirPosix
}));

vi.mock('../../src/script-utils/json.ts', () => ({
  editJson: mockEditJson
}));

vi.mock('../../src/script-utils/npm-run.ts', () => ({
  npmRun: mockNpmRun,
  npmRunOptional: mockNpmRunOptional
}));

vi.mock('../../src/debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
  mockEditPackageJson.mockResolvedValue(undefined);
  mockEditPackageLockJson.mockResolvedValue(undefined);
  mockEditNpmShrinkWrapJson.mockResolvedValue(undefined);
  mockEditJson.mockResolvedValue(undefined);
  mockCp.mockResolvedValue(undefined);
  mockRm.mockResolvedValue(undefined);
  mockNpmRun.mockResolvedValue(undefined);
  mockNpmRunOptional.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);
  mockResolvePathFromRootSafe.mockImplementation((path: string) => `/root/${path}`);
  mockExistsSync.mockReturnValue(false);
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

  it('should have PreMajor equal to "premajor"', () => {
    expect(VersionUpdateType.PreMajor).toBe('premajor');
  });

  it('should have PreMinor equal to "preminor"', () => {
    expect(VersionUpdateType.PreMinor).toBe('preminor');
  });

  it('should have PrePatch equal to "prepatch"', () => {
    expect(VersionUpdateType.PrePatch).toBe('prepatch');
  });

  it('should have PreRelease equal to "prerelease"', () => {
    expect(VersionUpdateType.PreRelease).toBe('prerelease');
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
    ['premajor', VersionUpdateType.PreMajor],
    ['preminor', VersionUpdateType.PreMinor],
    ['prepatch', VersionUpdateType.PrePatch],
    ['prerelease', VersionUpdateType.PreRelease],
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
    ['premajor'],
    ['preminor'],
    ['prepatch'],
    ['prerelease'],
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

  it('should bump prerelease from non-prerelease version', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.3' });
    const result = await getNewVersion('prerelease');
    expect(result).toBe('1.2.4-beta.0');
  });

  it('should increment prerelease from existing prerelease version', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.4-beta.0' });
    const result = await getNewVersion('prerelease');
    expect(result).toBe('1.2.4-beta.1');
  });

  it('should bump premajor version', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.3' });
    const result = await getNewVersion('premajor');
    expect(result).toBe('2.0.0-beta.0');
  });

  it('should bump preminor version', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.3' });
    const result = await getNewVersion('preminor');
    expect(result).toBe('1.3.0-beta.0');
  });

  it('should bump prepatch version', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.3' });
    const result = await getNewVersion('prepatch');
    expect(result).toBe('1.2.4-beta.0');
  });

  it('should promote prerelease to release on patch bump', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.4-beta.2' });
    const result = await getNewVersion('patch');
    expect(result).toBe('1.2.4');
  });

  it('should reset prerelease on major bump', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.4-beta.2' });
    const result = await getNewVersion('major');
    expect(result).toBe('2.0.0');
  });

  it('should reset prerelease on minor bump', async () => {
    mockReadPackageJson.mockResolvedValue({ version: '1.2.4-beta.2' });
    const result = await getNewVersion('minor');
    expect(result).toBe('1.3.0');
  });

  it('should throw for invalid current version', async () => {
    mockReadPackageJson.mockResolvedValue({ version: 'invalid' });
    await expect(getNewVersion('patch')).rejects.toThrow('Failed to increment version');
  });

  it('should throw for missing version in package.json', async () => {
    mockReadPackageJson.mockResolvedValue({});
    await expect(getNewVersion('patch')).rejects.toThrow('Failed to increment version');
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
    const updateFn = mockEditPackageLockJson.mock.calls[0]?.[0] as (lock: GenericObject) => void;
    const lockJson: GenericObject = { packages: { '': { version: '1.0.0' } }, version: '1.0.0' };
    updateFn(lockJson);
    expect(lockJson['version']).toBe('3.0.0');
    expect((lockJson['packages'] as Record<string, Record<string, string>>)['']?.['version']).toBe('3.0.0');
  });

  it('should handle lock file without packages entry', async () => {
    await updateVersionInFiles('3.0.0');
    const updateFn = mockEditPackageLockJson.mock.calls[0]?.[0] as (lock: GenericObject) => void;
    const lockJson: GenericObject = { version: '1.0.0' };
    updateFn(lockJson);
    expect(lockJson['version']).toBe('3.0.0');
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

describe('getReleaseNotes', () => {
  it('should return release notes with compare URL when previous tag exists', async () => {
    mockReadFile.mockResolvedValue('\n## 1.0.0\n\nSome changes here\n\n## 0.9.0\n\nOld\n');
    mockExecFromRoot
      .mockResolvedValueOnce('1.0.0\n0.9.0')
      .mockResolvedValueOnce('https://github.com/user/repo');
    const notes = await getReleaseNotes('1.0.0');
    expect(notes).toContain('Some changes here');
    expect(notes).toContain('https://github.com/user/repo/compare/0.9.0...1.0.0');
  });

  it('should use commits URL when no previous tag exists', async () => {
    mockReadFile.mockResolvedValue('# CHANGELOG\n\n');
    mockExecFromRoot
      .mockResolvedValueOnce('1.0.0')
      .mockResolvedValueOnce('https://github.com/user/repo');
    const notes = await getReleaseNotes('1.0.0');
    expect(notes).toContain('https://github.com/user/repo/commits/1.0.0');
  });

  it('should handle missing release notes section in changelog', async () => {
    mockReadFile.mockResolvedValue('# CHANGELOG\n\n## 0.9.0\n\nOld stuff\n');
    mockExecFromRoot
      .mockResolvedValueOnce('1.0.0\n0.9.0')
      .mockResolvedValueOnce('https://github.com/user/repo');
    const notes = await getReleaseNotes('1.0.0');
    expect(notes).toBe('**Full Changelog**: https://github.com/user/repo/compare/0.9.0...1.0.0');
  });
});

describe('publishGitHubRelease', () => {
  function setupReleaseNotesMocks(): void {
    mockReadFile.mockResolvedValue('# CHANGELOG\n\n');
    mockExecFromRoot.mockImplementation((cmd: string | string[]) => {
      const cmdStr = Array.isArray(cmd) ? cmd.join(' ') : cmd;
      if (cmdStr.startsWith('git tag')) {
        return Promise.resolve('1.0.0');
      }
      if (cmdStr.startsWith('gh repo view')) {
        return Promise.resolve('https://github.com/user/repo');
      }
      if (cmdStr.includes('npm pack')) {
        return Promise.resolve(JSON.stringify([{ filename: 'pkg-1.0.0.tgz' }]));
      }
      return Promise.resolve('');
    });
  }

  it('should publish release for obsidian plugin with dist/build files', async () => {
    setupReleaseNotesMocks();
    mockReaddirPosix.mockResolvedValue(['main.js', 'manifest.json', 'styles.css']);
    mockExistsSync.mockReturnValue(true);
    await publishGitHubRelease('1.0.0', true);
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['gh', 'release', 'create', '1.0.0']),
      expect.objectContaining({ isQuiet: true })
    );
  });

  it('should publish release for non-obsidian project with npm pack', async () => {
    setupReleaseNotesMocks();
    mockExistsSync.mockReturnValue(true);
    await publishGitHubRelease('1.0.0', false);
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['npm', 'pack', '--pack-destination', 'dist', '--json']),
      expect.any(Object)
    );
  });

  it('should filter out non-existent files', async () => {
    setupReleaseNotesMocks();
    mockReaddirPosix.mockResolvedValue(['main.js', 'missing.js']);
    mockExistsSync.mockImplementation((path: string) => !path.includes('missing'));
    await publishGitHubRelease('1.0.0', true);
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['gh', 'release', 'create']),
      expect.any(Object)
    );
  });

  it('should add --prerelease flag for pre-release versions', async () => {
    setupReleaseNotesMocks();
    mockReaddirPosix.mockResolvedValue(['main.js']);
    mockExistsSync.mockReturnValue(true);
    await publishGitHubRelease('1.0.0-beta.1', true);
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['--prerelease']),
      expect.any(Object)
    );
  });

  it('should not add --prerelease flag for stable versions', async () => {
    setupReleaseNotesMocks();
    mockReaddirPosix.mockResolvedValue(['main.js']);
    mockExistsSync.mockReturnValue(true);
    await publishGitHubRelease('1.0.0', true);
    const ghReleaseCall = mockExecFromRoot.mock.calls.find(
      (call: unknown[]) => Array.isArray(call[0]) && (call[0] as string[]).includes('gh')
    ) as [string[], unknown] | undefined;
    expect(ghReleaseCall?.[0]).not.toContain('--prerelease');
  });
});

describe('updateChangelog', () => {
  it('should create changelog from scratch when file does not exist', async () => {
    mockExistsSync.mockReturnValue(false);
    mockExecFromRoot
      .mockResolvedValueOnce('Initial commit\0')
      .mockResolvedValueOnce('');
    mockCreateInterface.mockReturnValue({
      question: vi.fn().mockResolvedValue(undefined)
    });
    await updateChangelog('1.0.0');
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('CHANGELOG.md'),
      expect.stringContaining('## 1.0.0'),
      'utf-8'
    );
  });

  it('should append to existing changelog', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue('# CHANGELOG\n\n## 0.9.0\n\n- Old change\n');
    mockExecFromRoot
      .mockResolvedValueOnce('New feature\0')
      .mockResolvedValueOnce('');
    mockCreateInterface.mockReturnValue({
      question: vi.fn().mockResolvedValue(undefined)
    });
    await updateChangelog('1.0.0');
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('## 0.9.0'),
      'utf-8'
    );
  });

  it('should open VS Code when available', async () => {
    mockExistsSync.mockReturnValue(false);
    mockExecFromRoot
      .mockResolvedValueOnce('msg\0')
      .mockResolvedValueOnce('1.92.0')
      .mockResolvedValueOnce('');
    await updateChangelog('1.0.0');
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['code', '-w']),
      expect.any(Object)
    );
  });

  it('should fall back to console when VS Code is not available', async () => {
    mockExistsSync.mockReturnValue(false);
    mockExecFromRoot
      .mockResolvedValueOnce('msg\0')
      .mockResolvedValueOnce('');
    mockCreateInterface.mockReturnValue({
      question: vi.fn().mockResolvedValue(undefined)
    });
    await updateChangelog('1.0.0');
    expect(mockCreateInterface).toHaveBeenCalled();
  });

  it('should handle multi-line commit messages by joining them', async () => {
    mockExistsSync.mockReturnValue(false);
    mockExecFromRoot
      .mockResolvedValueOnce('Line1\nLine2\0')
      .mockResolvedValueOnce('');
    mockCreateInterface.mockReturnValue({
      question: vi.fn().mockResolvedValue(undefined)
    });
    await updateChangelog('1.0.0');
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('- Line1 Line2'),
      'utf-8'
    );
  });

  it('should handle existing changelog without trailing newline', async () => {
    mockExistsSync.mockReturnValue(true);
    // No trailing \n — last element after split won't be ''
    mockReadFile.mockResolvedValue('# CHANGELOG\n\n## 0.9.0\n\n- Old change');
    mockExecFromRoot
      .mockResolvedValueOnce('New feature\0')
      .mockResolvedValueOnce('');
    mockCreateInterface.mockReturnValue({
      question: vi.fn().mockResolvedValue(undefined)
    });
    await updateChangelog('1.0.0');
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('## 0.9.0'),
      'utf-8'
    );
  });
});

describe('updateVersion', () => {
  function setupFullMocks(): void {
    mockReadPackageJson.mockResolvedValue({ name: 'my-plugin', version: '1.0.0' });
    mockExistsSync.mockReturnValue(false);
    mockReadFile.mockResolvedValue('# CHANGELOG\n\n');
    mockCreateInterface.mockReturnValue({
      question: vi.fn().mockResolvedValue(undefined)
    });
    mockExecFromRoot.mockImplementation((cmd: string | string[]) => {
      const cmdStr = Array.isArray(cmd) ? cmd.join(' ') : cmd;
      if (cmdStr.startsWith('git tag')) {
        return Promise.resolve('1.0.1');
      }
      if (cmdStr.startsWith('gh repo view')) {
        return Promise.resolve('https://github.com/user/repo');
      }
      if (cmdStr.includes('npm pack')) {
        return Promise.resolve(JSON.stringify([{ filename: 'pkg-1.0.1.tgz' }]));
      }
      return Promise.resolve('');
    });
  }

  it('should throw when no version update type provided and no env vars', async () => {
    await expect(updateVersion()).rejects.toThrow('No version update type provided');
  });

  it('should throw for invalid version update type', async () => {
    await expect(updateVersion('invalid')).rejects.toThrow('Invalid version update type');
  });

  it('should run full pipeline for non-obsidian-plugin project', async () => {
    setupFullMocks();
    mockReaddirPosix.mockResolvedValue([]);
    await updateVersion('patch');
    expect(mockNpmRun).toHaveBeenCalledWith('format:check');
    expect(mockNpmRun).toHaveBeenCalledWith('spellcheck');
    expect(mockNpmRun).toHaveBeenCalledWith('lint:md');
    expect(mockNpmRun).toHaveBeenCalledWith('build');
    expect(mockNpmRun).toHaveBeenCalledWith('lint');
    expect(mockNpmRunOptional).toHaveBeenCalledWith('test');
    expect(mockEditPackageJson).toHaveBeenCalled();
  });

  it('should call prepareGitHubRelease callback when provided', async () => {
    setupFullMocks();
    mockReaddirPosix.mockResolvedValue([]);
    const prepareRelease = vi.fn().mockResolvedValue(undefined);
    await updateVersion('patch', prepareRelease);
    expect(prepareRelease).toHaveBeenCalledWith('1.0.1');
  });

  it('should run updateVersionInFilesForPlugin for obsidian plugin with prerelease', async () => {
    setupFullMocks();
    mockReadPackageJson.mockResolvedValue({ name: 'my-plugin', version: '1.0.0' });
    mockExistsSync.mockImplementation((path: string) => path.includes('manifest.json'));
    mockReaddirPosix.mockResolvedValue([]);
    await updateVersion('prerelease');
    expect(mockCp).toHaveBeenCalled();
    expect(mockEditJson).toHaveBeenCalledTimes(1);

    const betaManifestCallback = mockEditJson.mock.calls[0]?.[1] as (m: Record<string, string>) => void;
    const betaManifest: Record<string, string> = { version: '1.0.0' };
    betaManifestCallback(betaManifest);
    expect(betaManifest['version']).toBe('1.0.1-beta.0');
  });

  it('should use npm env vars when no version type provided', async () => {
    vi.stubEnv('npm_old_version', '1.0.0');
    vi.stubEnv('npm_new_version', '1.0.1');
    try {
      setupFullMocks();
      mockReaddirPosix.mockResolvedValue([]);
      await updateVersion(undefined);
      expect(mockEditPackageJson).toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('should update plugin manifest with latest obsidian version for non-beta release', async () => {
    setupFullMocks();
    mockReadPackageJson.mockResolvedValue({ name: 'my-plugin', version: '1.0.0' });
    mockExistsSync.mockImplementation((path: string) => path.includes('manifest.json'));
    mockReaddirPosix.mockResolvedValue([]);

    const mockFetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ name: '1.7.0' })
    });
    vi.stubGlobal('fetch', mockFetch);

    try {
      await updateVersion('patch');
      expect(mockEditJson).toHaveBeenCalledTimes(2);

      const manifestCallback = mockEditJson.mock.calls[0]?.[1] as (m: Record<string, string>) => void;
      const manifest: Record<string, string> = { minAppVersion: '1.0.0', version: '1.0.0' };
      manifestCallback(manifest);
      expect(manifest['minAppVersion']).toBe('1.7.0');
      expect(manifest['version']).toBe('1.0.1');

      const versionsCallback = mockEditJson.mock.calls[1]?.[1] as (v: Record<string, string>) => void;
      const versions: Record<string, string> = {};
      versionsCallback(versions);
      expect(versions['1.0.1']).toBe('1.7.0');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('should remove manifest-beta.json for non-prerelease obsidian plugin release when it exists', async () => {
    setupFullMocks();
    mockReadPackageJson.mockResolvedValue({ name: 'my-plugin', version: '1.0.0' });
    mockExistsSync.mockImplementation((path: string) => path.includes('manifest.json') || path.includes('manifest-beta.json'));
    mockReaddirPosix.mockResolvedValue([]);

    const mockFetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ name: '1.7.0' })
    });
    vi.stubGlobal('fetch', mockFetch);

    try {
      await updateVersion('patch');
      expect(mockRm).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('version', () => {
  it('should delegate to updateVersion', async () => {
    await expect(version('invalid')).rejects.toThrow('Invalid version update type');
  });
});
