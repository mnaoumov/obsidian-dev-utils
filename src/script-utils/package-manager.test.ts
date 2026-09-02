import type { MockInstance } from 'vitest';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noop } from '../function.ts';
import {
  getPackageManager,
  getPackageManagerRunCommand,
  PackageManager,
  resolveToolCommand
} from './package-manager.ts';

const {
  mockExistsSync,
  mockReadFileSync
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockReadFileSync: vi.fn<(path: string) => string>()
}));

vi.mock('node:fs', async (importOriginal) => {
  const $module = await importOriginal<typeof import('node:fs')>();
  return {
    ...$module,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync
  };
});

const ORIGINAL_PLATFORM = process.platform;
const ORIGINAL_USER_AGENT = process.env['npm_config_user_agent'];

let consoleWarnSpy: MockInstance<typeof console.warn>;

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
 * Makes {@link mockReadFileSync} return the given text for every file it is asked to read.
 *
 * The module reads exactly one file through it — the project's `package.json` — so a single value is
 * enough.
 *
 * @param text - The file contents to report.
 */
function setPackageJsonText(text: string): void {
  mockReadFileSync.mockReturnValue(text);
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
  setPackageJsonText('{}');
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(noop);
});

afterEach(() => {
  consoleWarnSpy.mockRestore();
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

  it('should fall back to the working folder when no cwd is given and no project root exists', () => {
    setExistingPaths([]);
    expect(getPackageManager()).toBe(PackageManager.Npm);
  });

  it('should treat both bun lockfiles as a single claim', () => {
    setExistingPaths([
      '/bun-both/package.json',
      '/bun-both/bun.lock',
      '/bun-both/bun.lockb'
    ]);
    expect(getPackageManager('/bun-both')).toBe(PackageManager.Bun);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});

describe('getPackageManager with several lockfiles', () => {
  it('should prefer the manager that launched us when it owns one of the lockfiles', () => {
    setExistingPaths([
      '/several-user-agent/package.json',
      '/several-user-agent/pnpm-lock.yaml',
      '/several-user-agent/package-lock.json'
    ]);
    process.env['npm_config_user_agent'] = 'npm/12.0.2 node/v26.5.0 win32 x64 workspaces/false';
    expect(getPackageManager('/several-user-agent')).toBe(PackageManager.Npm);
  });

  it('should fall back to the documented order when no user agent is set', () => {
    setExistingPaths([
      '/several-no-user-agent/package.json',
      '/several-no-user-agent/pnpm-lock.yaml',
      '/several-no-user-agent/package-lock.json'
    ]);
    expect(getPackageManager('/several-no-user-agent')).toBe(PackageManager.Pnpm);
  });

  it('should ignore a user agent that owns none of the lockfiles', () => {
    setExistingPaths([
      '/several-foreign-user-agent/package.json',
      '/several-foreign-user-agent/pnpm-lock.yaml',
      '/several-foreign-user-agent/package-lock.json'
    ]);
    process.env['npm_config_user_agent'] = 'yarn/1.22.22 npm/? node/v26.5.0 win32 x64';
    expect(getPackageManager('/several-foreign-user-agent')).toBe(PackageManager.Pnpm);
  });

  it('should name every lockfile, the declaration and the winner in the warning', () => {
    setExistingPaths([
      '/several-warning/package.json',
      '/several-warning/pnpm-lock.yaml',
      '/several-warning/package-lock.json'
    ]);
    getPackageManager('/several-warning');
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    const message = consoleWarnSpy.mock.calls[0]?.[0] as string;
    expect(message).toContain('/several-warning');
    expect(message).toContain('pnpm-lock.yaml, package-lock.json');
    expect(message).toContain('not set');
    expect(message).toContain('Using pnpm');
  });

  it('should warn once per project however often it is called', () => {
    setExistingPaths([
      '/several-repeated/package.json',
      '/several-repeated/pnpm-lock.yaml',
      '/several-repeated/package-lock.json'
    ]);
    getPackageManager('/several-repeated');
    getPackageManager('/several-repeated');
    getPackageManager('/several-repeated');
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('getPackageManager with a packageManager declaration', () => {
  it('should prefer the declaration over a contradicting lockfile', () => {
    setExistingPaths([
      '/declared-vs-lockfile/package.json',
      '/declared-vs-lockfile/package-lock.json'
    ]);
    setPackageJsonText('{ "packageManager": "pnpm@11.24.0" }');
    expect(getPackageManager('/declared-vs-lockfile')).toBe(PackageManager.Pnpm);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
  });

  it('should read the declaration when there is no lockfile at all', () => {
    setExistingPaths(['/declared-no-lockfile/package.json']);
    setPackageJsonText('{ "packageManager": "yarn@4.2.2" }');
    expect(getPackageManager('/declared-no-lockfile')).toBe(PackageManager.Yarn);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should stay silent when the declaration agrees with the lockfile', () => {
    setExistingPaths([
      '/declared-agreeing/package.json',
      '/declared-agreeing/pnpm-lock.yaml'
    ]);
    setPackageJsonText('{ "packageManager": "pnpm@11.24.0" }');
    expect(getPackageManager('/declared-agreeing')).toBe(PackageManager.Pnpm);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should ignore a declaration naming a manager we do not handle', () => {
    setExistingPaths([
      '/declared-unknown/package.json',
      '/declared-unknown/package-lock.json'
    ]);
    setPackageJsonText('{ "packageManager": "deno@2.0.0" }');
    expect(getPackageManager('/declared-unknown')).toBe(PackageManager.Npm);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should ignore a declaration that omits the version', () => {
    setExistingPaths([
      '/declared-no-version/package.json',
      '/declared-no-version/package-lock.json'
    ]);
    setPackageJsonText('{ "packageManager": "pnpm" }');
    expect(getPackageManager('/declared-no-version')).toBe(PackageManager.Npm);
  });

  it('should ignore an empty declaration', () => {
    setExistingPaths([
      '/declared-empty/package.json',
      '/declared-empty/package-lock.json'
    ]);
    setPackageJsonText('{ "packageManager": "" }');
    expect(getPackageManager('/declared-empty')).toBe(PackageManager.Npm);
  });

  it('should ignore an unparsable package.json', () => {
    setExistingPaths([
      '/unparsable/package.json',
      '/unparsable/package-lock.json'
    ]);
    setPackageJsonText('not json at all');
    expect(getPackageManager('/unparsable')).toBe(PackageManager.Npm);
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
