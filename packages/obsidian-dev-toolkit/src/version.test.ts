import type { EditJsonParams } from '@mnaoumov/typescript-dev-toolkit/json';
import type { ResolvePathFromRootSafeParams } from '@mnaoumov/typescript-dev-toolkit/root';
import type { UpdateVersionOptions as GenericUpdateVersionOptions } from '@mnaoumov/typescript-dev-toolkit/version';

import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { assertNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  copyUpdatedManifest,
  parseVersionArguments,
  updateVersion
} from './version.ts';

const {
  mockArchivePluginDemoVault,
  mockCp,
  mockEditJson,
  mockExistsSync,
  mockReaddirPosix,
  mockResolvePathFromRootSafe,
  mockRm,
  mockUpdateVersionGeneric
} = vi.hoisted(() => ({
  mockArchivePluginDemoVault: vi.fn(),
  mockCp: vi.fn(),
  mockEditJson: vi.fn(),
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockReaddirPosix: vi.fn<(path: string) => Promise<string[]>>(),
  mockResolvePathFromRootSafe: vi.fn<(params: ResolvePathFromRootSafeParams) => string>(),
  mockRm: vi.fn(),
  mockUpdateVersionGeneric: vi.fn<(versionUpdateType?: string, options?: GenericUpdateVersionOptions) => Promise<void>>()
}));

vi.mock('./demo-vault.ts', () => ({
  archivePluginDemoVault: mockArchivePluginDemoVault
}));

vi.mock('@mnaoumov/typescript-dev-toolkit/fs', () => ({
  readdirPosix: mockReaddirPosix
}));

vi.mock('@mnaoumov/typescript-dev-toolkit/json', () => ({
  editJson: mockEditJson
}));

vi.mock('@mnaoumov/typescript-dev-toolkit/root', () => ({
  resolvePathFromRootSafe: mockResolvePathFromRootSafe
}));

vi.mock('@mnaoumov/typescript-dev-toolkit/version', async (importOriginal) => ({
  ...await importOriginal<typeof import('@mnaoumov/typescript-dev-toolkit/version')>(),
  updateVersion: mockUpdateVersionGeneric
}));

vi.mock('node:fs', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:fs')>(),
  existsSync: mockExistsSync
}));

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:fs/promises')>(),
  cp: mockCp,
  rm: mockRm
}));

const DESKTOP_RELEASES_JSON_URL = 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/desktop-releases.json';

beforeEach(() => {
  vi.resetAllMocks();
  mockArchivePluginDemoVault.mockResolvedValue(null);
  mockCp.mockResolvedValue(undefined);
  mockEditJson.mockResolvedValue(undefined);
  mockExistsSync.mockReturnValue(false);
  mockReaddirPosix.mockResolvedValue([]);
  mockResolvePathFromRootSafe.mockImplementation((params: ResolvePathFromRootSafeParams) => `/root/${params.path}`);
  mockRm.mockResolvedValue(undefined);
  mockUpdateVersionGeneric.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Runs the wrapper and hands back the options it passed to the generic release, so a case can drive the hooks.
 *
 * @param versionUpdateType - The version update type.
 * @param options - The wrapper's options.
 * @returns The options the generic `updateVersion` received.
 */
async function captureGenericOptions(versionUpdateType: string, options?: Parameters<typeof updateVersion>[1]): Promise<GenericUpdateVersionOptions> {
  await updateVersion(versionUpdateType, options);
  const genericOptions = mockUpdateVersionGeneric.mock.calls[0]?.[1];
  assertNonNullable(genericOptions);
  return genericOptions;
}

function getEditJsonParams(callIndex: number): EditJsonParams<Record<string, string>> {
  const params = mockEditJson.mock.calls[callIndex]?.[0] as EditJsonParams<Record<string, string>> | undefined;
  assertNonNullable(params);
  return params;
}

function stubDesktopReleasesFeed(desktopReleasesJson: object): ReturnType<typeof vi.fn> {
  const mockFetch = vi.fn().mockResolvedValue({
    json: vi.fn().mockResolvedValue(desktopReleasesJson)
  });
  vi.stubGlobal('fetch', mockFetch);
  return mockFetch;
}

async function updateVersionInExtraFiles(newVersion: string, options?: Parameters<typeof updateVersion>[1]): Promise<void> {
  const genericOptions = await captureGenericOptions('patch', options);
  assertNonNullable(genericOptions.updateVersionInExtraFiles);
  await genericOptions.updateVersionInExtraFiles(newVersion);
}

describe('copyUpdatedManifest', () => {
  it('should copy manifest.json to the dist/build folder', async () => {
    await copyUpdatedManifest();
    expect(mockCp).toHaveBeenCalledTimes(1);
    expect(mockCp).toHaveBeenCalledWith('/root/manifest.json', '/root/dist/build/manifest.json', { force: true });
  });
});

describe('parseVersionArguments', () => {
  it('should parse the version update type with no flags', () => {
    const { options, versionUpdateType } = parseVersionArguments(['patch']);
    expect(versionUpdateType).toBe('patch');
    expect(options).toEqual({
      changelogFilePath: undefined,
      minAppVersion: undefined,
      shouldArchiveDemoVault: true,
      shouldBuild: true,
      shouldCloseReleasedIssues: true,
      shouldEditChangelog: true,
      shouldRelease: true,
      shouldRunChecks: true,
      shouldVerifyCommit: true
    });
  });

  it('should parse the generic flags together with the plugin flags', () => {
    const { options, versionUpdateType } = parseVersionArguments([
      'patch',
      '--changelog-file=notes.md',
      '--min-app-version=1.9.0',
      '--no-build',
      '--no-changelog-editing',
      '--no-checks',
      '--no-commit-verification',
      '--no-demo-vault',
      '--no-issue-closing',
      '--no-release'
    ]);
    expect(versionUpdateType).toBe('patch');
    expect(options).toEqual({
      changelogFilePath: 'notes.md',
      minAppVersion: '1.9.0',
      shouldArchiveDemoVault: false,
      shouldBuild: false,
      shouldCloseReleasedIssues: false,
      shouldEditChangelog: false,
      shouldRelease: false,
      shouldRunChecks: false,
      shouldVerifyCommit: false
    });
  });

  it('should return an undefined version update type when no positional is provided', () => {
    const { versionUpdateType } = parseVersionArguments(['--no-demo-vault']);
    expect(versionUpdateType).toBeUndefined();
  });
});

describe('updateVersion', () => {
  it('should forward the generic options to the generic release and keep the plugin options to itself', async () => {
    const genericOptions = await captureGenericOptions('minor', {
      minAppVersion: '1.9.0',
      shouldArchiveDemoVault: false,
      shouldBuild: false,
      shouldRelease: false
    });
    expect(mockUpdateVersionGeneric).toHaveBeenCalledWith('minor', expect.any(Object));
    expect(genericOptions.shouldBuild).toBe(false);
    expect(genericOptions.shouldRelease).toBe(false);
    expect(genericOptions).not.toHaveProperty('minAppVersion');
    expect(genericOptions).not.toHaveProperty('shouldArchiveDemoVault');
  });

  it('should run with no arguments at all', async () => {
    await updateVersion();
    expect(mockUpdateVersionGeneric).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        getReleaseAssetPaths: expect.any(Function) as unknown,
        prepareGitHubRelease: expect.any(Function) as unknown,
        updateVersionInExtraFiles: expect.any(Function) as unknown
      })
    );
  });

  describe('the release assets', () => {
    it('should be every file in dist/build', async () => {
      mockReaddirPosix.mockResolvedValue(['main.js', 'manifest.json', 'styles.css']);
      const genericOptions = await captureGenericOptions('patch');
      assertNonNullable(genericOptions.getReleaseAssetPaths);
      const assetPaths = await genericOptions.getReleaseAssetPaths();
      expect(mockReaddirPosix).toHaveBeenCalledWith('/root/dist/build');
      expect(assetPaths).toEqual(['/root/dist/build/main.js', '/root/dist/build/manifest.json', '/root/dist/build/styles.css']);
    });
  });

  describe('the GitHub release preparation', () => {
    it('should run the caller\'s preparation first and then archive the demo vault', async () => {
      const steps: string[] = [];
      const prepareGitHubRelease = vi.fn((newVersion: string) => {
        steps.push(`prepare ${newVersion}`);
        return noopAsync();
      });
      mockArchivePluginDemoVault.mockImplementation(() => {
        steps.push('archive');
        return Promise.resolve(null);
      });
      const genericOptions = await captureGenericOptions('patch', { prepareGitHubRelease });
      assertNonNullable(genericOptions.prepareGitHubRelease);
      await genericOptions.prepareGitHubRelease('1.0.1');
      expect(steps).toEqual(['prepare 1.0.1', 'archive']);
    });

    it('should archive the demo vault when the caller has no preparation of its own', async () => {
      const genericOptions = await captureGenericOptions('patch');
      assertNonNullable(genericOptions.prepareGitHubRelease);
      await genericOptions.prepareGitHubRelease('1.0.1');
      expect(mockArchivePluginDemoVault).toHaveBeenCalledTimes(1);
    });

    it('should not archive the demo vault when shouldArchiveDemoVault is false', async () => {
      const prepareGitHubRelease = vi.fn(noopAsync);
      const genericOptions = await captureGenericOptions('patch', { prepareGitHubRelease, shouldArchiveDemoVault: false });
      assertNonNullable(genericOptions.prepareGitHubRelease);
      await genericOptions.prepareGitHubRelease('1.0.1');
      expect(prepareGitHubRelease).toHaveBeenCalledWith('1.0.1');
      expect(mockArchivePluginDemoVault).not.toHaveBeenCalled();
    });
  });

  describe('the plugin files', () => {
    it('should copy manifest.json to manifest-beta.json with the new version for a pre-release', async () => {
      const mockFetch = stubDesktopReleasesFeed({ latestVersion: '1.7.0' });
      await updateVersionInExtraFiles('1.0.1-beta.0');

      expect(mockCp).toHaveBeenNthCalledWith(1, '/root/manifest.json', '/root/manifest-beta.json', { force: true });
      expect(mockEditJson).toHaveBeenCalledTimes(1);
      const params = getEditJsonParams(0);
      expect(params.path).toBe('manifest-beta.json');
      const betaManifest: Record<string, string> = { version: '1.0.0' };
      await params.editFunction(betaManifest);
      expect(betaManifest).toEqual({ version: '1.0.1-beta.0' });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockRm).not.toHaveBeenCalled();
      expect(mockCp).toHaveBeenNthCalledWith(2, '/root/manifest.json', '/root/dist/build/manifest.json', { force: true });
    });

    it('should use the minAppVersion option verbatim without fetching', async () => {
      const mockFetch = stubDesktopReleasesFeed({ latestVersion: '1.7.0' });
      await updateVersionInExtraFiles('1.0.1', { minAppVersion: '1.9.0' });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockEditJson).toHaveBeenCalledTimes(2);

      const manifestParams = getEditJsonParams(0);
      expect(manifestParams.path).toBe('manifest.json');
      const manifest: Record<string, string> = { minAppVersion: '1.0.0', version: '1.0.0' };
      await manifestParams.editFunction(manifest);
      expect(manifest).toEqual({ minAppVersion: '1.9.0', version: '1.0.1' });

      const versionsParams = getEditJsonParams(1);
      expect(versionsParams.path).toBe('versions.json');
      const versions: Record<string, string> = {};
      await versionsParams.editFunction(versions);
      expect(versions).toEqual({ '1.0.1': '1.9.0' });

      expect(mockRm).not.toHaveBeenCalled();
      expect(mockCp).toHaveBeenCalledTimes(1);
      expect(mockCp).toHaveBeenCalledWith('/root/manifest.json', '/root/dist/build/manifest.json', { force: true });
    });

    it('should read the latest Obsidian version from the desktop releases feed', async () => {
      const mockFetch = stubDesktopReleasesFeed({ latestVersion: '1.7.0' });
      await updateVersionInExtraFiles('1.0.1');

      expect(mockFetch).toHaveBeenCalledWith(DESKTOP_RELEASES_JSON_URL);
      const manifest: Record<string, string> = { minAppVersion: '1.0.0', version: '1.0.0' };
      await getEditJsonParams(0).editFunction(manifest);
      expect(manifest).toEqual({ minAppVersion: '1.7.0', version: '1.0.1' });
      const versions: Record<string, string> = {};
      await getEditJsonParams(1).editFunction(versions);
      expect(versions).toEqual({ '1.0.1': '1.7.0' });
    });

    it('should throw when the desktop releases feed has no latest version', async () => {
      stubDesktopReleasesFeed({});
      await expect(updateVersionInExtraFiles('1.0.1')).rejects.toThrow('Could not find the latest desktop Obsidian version');
      expect(mockEditJson).not.toHaveBeenCalled();
    });

    it('should remove manifest-beta.json for a stable release when it exists', async () => {
      mockExistsSync.mockImplementation((path: string) => path === '/root/manifest-beta.json');
      await updateVersionInExtraFiles('1.0.1', { minAppVersion: '1.9.0' });
      expect(mockRm).toHaveBeenCalledWith('/root/manifest-beta.json');
    });
  });
});
