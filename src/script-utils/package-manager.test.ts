import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  getPackageManager,
  getPackageManagerRunCommand,
  PackageManager,
  resolveToolCommand
} from './package-manager.ts';

const {
  mockExistsSync
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn<(path: string) => boolean>()
}));

vi.mock('node:fs', async (importOriginal) => {
  const $module = await importOriginal<typeof import('node:fs')>();
  return {
    ...$module,
    existsSync: mockExistsSync
  };
});

const ORIGINAL_PLATFORM = process.platform;
const ORIGINAL_USER_AGENT = process.env['npm_config_user_agent'];

/**
 * Makes {@link mockExistsSync} report exactly the given paths as existing.
 *
 * @param paths - The paths that should exist.
 */
function setExistingPaths(paths: string[]): void {
  const existing = new Set(paths);
  mockExistsSync.mockImplementation((path: string) => existing.has(path));
}

/**
 * Overrides the reported platform for the duration of a test.
 *
 * @param platform - The platform to report.
 */
function setPlatform(platform: string): void {
  Object.defineProperty(process, 'platform', { configurable: true, value: platform });
}

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env['npm_config_user_agent'];
});

afterEach(() => {
  Object.defineProperty(process, 'platform', { configurable: true, value: ORIGINAL_PLATFORM });
  if (ORIGINAL_USER_AGENT === undefined) {
    delete process.env['npm_config_user_agent'];
  } else {
    process.env['npm_config_user_agent'] = ORIGINAL_USER_AGENT;
  }
});

describe('resolveToolCommand', () => {
  it('should resolve the cmd shim on Windows', () => {
    setPlatform('win32');
    setExistingPaths([
      'C:/project/package.json',
      'C:/project/node_modules/.bin/tsc',
      'C:/project/node_modules/.bin/tsc.cmd'
    ]);
    expect(resolveToolCommand({ cwd: 'C:/project', tool: 'tsc' })).toEqual(['C:/project/node_modules/.bin/tsc.cmd']);
  });

  it('should resolve the exe shim on Windows when only bun shims exist', () => {
    setPlatform('win32');
    setExistingPaths([
      'C:/project/package.json',
      'C:/project/node_modules/.bin/tsc.exe'
    ]);
    expect(resolveToolCommand({ cwd: 'C:/project', tool: 'tsc' })).toEqual(['C:/project/node_modules/.bin/tsc.exe']);
  });

  it('should resolve the bat shim on Windows when it is the only one', () => {
    setPlatform('win32');
    setExistingPaths([
      'C:/project/package.json',
      'C:/project/node_modules/.bin/tsc.bat'
    ]);
    expect(resolveToolCommand({ cwd: 'C:/project', tool: 'tsc' })).toEqual(['C:/project/node_modules/.bin/tsc.bat']);
  });

  it('should never resolve the sh shim with no extension on Windows', () => {
    setPlatform('win32');
    setExistingPaths([
      'C:/project/package.json',
      'C:/project/package-lock.json',
      'C:/project/node_modules/.bin/tsc'
    ]);
    expect(resolveToolCommand({ cwd: 'C:/project', tool: 'tsc' })).toEqual(['npx', 'tsc']);
  });

  it('should resolve the shim with no extension on non-Windows', () => {
    setPlatform('linux');
    setExistingPaths([
      '/project/package.json',
      '/project/node_modules/.bin/tsc'
    ]);
    expect(resolveToolCommand({ cwd: '/project', tool: 'tsc' })).toEqual(['/project/node_modules/.bin/tsc']);
  });

  it('should find a hoisted shim above the package root', () => {
    setPlatform('linux');
    setExistingPaths([
      '/project/packages/a/package.json',
      '/project/node_modules/.bin/tsc'
    ]);
    expect(resolveToolCommand({ cwd: '/project/packages/a', tool: 'tsc' })).toEqual(['/project/node_modules/.bin/tsc']);
  });

  it('should fall back to npx when no shim exists', () => {
    setPlatform('linux');
    setExistingPaths([
      '/project/package.json',
      '/project/package-lock.json'
    ]);
    expect(resolveToolCommand({ cwd: '/project', tool: 'tsc' })).toEqual(['npx', 'tsc']);
  });

  it('should fall back to the bun exec form when no shim exists', () => {
    setPlatform('linux');
    setExistingPaths([
      '/project/package.json',
      '/project/bun.lock'
    ]);
    expect(resolveToolCommand({ cwd: '/project', tool: 'tsc' })).toEqual(['bun', 'x', 'tsc']);
  });

  it('should fall back to the pnpm exec form when no shim exists', () => {
    setPlatform('linux');
    setExistingPaths([
      '/project/package.json',
      '/project/pnpm-lock.yaml'
    ]);
    expect(resolveToolCommand({ cwd: '/project', tool: 'tsc' })).toEqual(['pnpm', 'exec', 'tsc']);
  });

  it('should fall back to the yarn exec form when no shim exists', () => {
    setPlatform('linux');
    setExistingPaths([
      '/project/package.json',
      '/project/yarn.lock'
    ]);
    expect(resolveToolCommand({ cwd: '/project', tool: 'tsc' })).toEqual(['yarn', 'exec', 'tsc']);
  });

  it('should fall back to npx when the folder is outside any package', () => {
    setPlatform('linux');
    setExistingPaths([]);
    expect(resolveToolCommand({ cwd: '/nowhere', tool: 'tsc' })).toEqual(['npx', 'tsc']);
  });
});

describe('getPackageManager', () => {
  it('should detect bun from bun.lock', () => {
    setExistingPaths(['/project/package.json', '/project/bun.lock']);
    expect(getPackageManager('/project')).toBe(PackageManager.Bun);
  });

  it('should detect bun from bun.lockb', () => {
    setExistingPaths(['/project/package.json', '/project/bun.lockb']);
    expect(getPackageManager('/project')).toBe(PackageManager.Bun);
  });

  it('should detect pnpm from pnpm-lock.yaml', () => {
    setExistingPaths(['/project/package.json', '/project/pnpm-lock.yaml']);
    expect(getPackageManager('/project')).toBe(PackageManager.Pnpm);
  });

  it('should detect yarn from yarn.lock', () => {
    setExistingPaths(['/project/package.json', '/project/yarn.lock']);
    expect(getPackageManager('/project')).toBe(PackageManager.Yarn);
  });

  it('should detect npm from package-lock.json', () => {
    setExistingPaths(['/project/package.json', '/project/package-lock.json']);
    expect(getPackageManager('/project')).toBe(PackageManager.Npm);
  });

  it('should fall back to the user agent when no lockfile exists', () => {
    setExistingPaths(['/project/package.json']);
    process.env['npm_config_user_agent'] = 'bun/1.4.0 npm/? node/v26.5.0 win32 x64';
    expect(getPackageManager('/project')).toBe(PackageManager.Bun);
  });

  it('should read npm from the user agent when no lockfile exists', () => {
    setExistingPaths(['/project/package.json']);
    process.env['npm_config_user_agent'] = 'npm/12.0.2 node/v26.5.0 win32 x64 workspaces/false';
    expect(getPackageManager('/project')).toBe(PackageManager.Npm);
  });

  it('should read pnpm from the user agent when no lockfile exists', () => {
    setExistingPaths(['/project/package.json']);
    process.env['npm_config_user_agent'] = 'pnpm/11.24.0 npm/? node/v26.5.0 win32 x64';
    expect(getPackageManager('/project')).toBe(PackageManager.Pnpm);
  });

  it('should read yarn from the user agent when no lockfile exists', () => {
    setExistingPaths(['/project/package.json']);
    process.env['npm_config_user_agent'] = 'yarn/1.22.22 npm/? node/v26.5.0 win32 x64';
    expect(getPackageManager('/project')).toBe(PackageManager.Yarn);
  });

  it('should ignore an unrecognized user agent', () => {
    setExistingPaths(['/project/package.json']);
    process.env['npm_config_user_agent'] = 'deno/2.0.0 node/v26.5.0';
    expect(getPackageManager('/project')).toBe(PackageManager.Npm);
  });

  it('should ignore a malformed user agent', () => {
    setExistingPaths(['/project/package.json']);
    process.env['npm_config_user_agent'] = 'nonsense';
    expect(getPackageManager('/project')).toBe(PackageManager.Npm);
  });

  it('should default to npm when there is no lockfile and no user agent', () => {
    setExistingPaths(['/project/package.json']);
    expect(getPackageManager('/project')).toBe(PackageManager.Npm);
  });
});

describe('getPackageManagerRunCommand', () => {
  it('should run scripts through npm', () => {
    setExistingPaths(['/project/package.json', '/project/package-lock.json']);
    expect(getPackageManagerRunCommand('/project')).toEqual(['npm', 'run']);
  });

  it('should run scripts through bun', () => {
    setExistingPaths(['/project/package.json', '/project/bun.lock']);
    expect(getPackageManagerRunCommand('/project')).toEqual(['bun', 'run']);
  });

  it('should run scripts through pnpm', () => {
    setExistingPaths(['/project/package.json', '/project/pnpm-lock.yaml']);
    expect(getPackageManagerRunCommand('/project')).toEqual(['pnpm', 'run']);
  });

  it('should run scripts through yarn', () => {
    setExistingPaths(['/project/package.json', '/project/yarn.lock']);
    expect(getPackageManagerRunCommand('/project')).toEqual(['yarn', 'run']);
  });
});
