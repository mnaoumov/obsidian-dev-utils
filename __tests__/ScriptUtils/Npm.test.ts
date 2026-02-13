import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  editNpmShrinkWrapJson,
  editPackageJson,
  editPackageJsonSync,
  editPackageLockJson,
  editPackageLockJsonSync,
  getNpmShrinkWrapJsonPath,
  getPackageJsonPath,
  getPackageLockJsonPath,
  readPackageJson,
  readPackageJsonSync,
  readPackageLockJson,
  readPackageLockJsonSync,
  writePackageJson,
  writePackageJsonSync,
  writePackageLockJson,
  writePackageLockJsonSync
} from '../../src/ScriptUtils/Npm.ts';

const {
  mockEditJson,
  mockEditJsonSync,
  mockReadJson,
  mockReadJsonSync,
  mockResolvePathFromRoot,
  mockWriteJson,
  mockWriteJsonSync
} = vi.hoisted(() => ({
  mockEditJson: vi.fn(),
  mockEditJsonSync: vi.fn(),
  mockReadJson: vi.fn(),
  mockReadJsonSync: vi.fn(),
  mockResolvePathFromRoot: vi.fn<(path: string, cwd?: string) => null | string>(),
  mockWriteJson: vi.fn(),
  mockWriteJsonSync: vi.fn()
}));

vi.mock('../../src/ScriptUtils/JSON.ts', () => ({
  editJson: mockEditJson,
  editJsonSync: mockEditJsonSync,
  readJson: mockReadJson,
  readJsonSync: mockReadJsonSync,
  writeJson: mockWriteJson,
  writeJsonSync: mockWriteJsonSync
}));

vi.mock('../../src/ScriptUtils/Root.ts', () => ({
  resolvePathFromRoot: mockResolvePathFromRoot
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockResolvePathFromRoot.mockImplementation((path: string) => `/root/${path}`);
  mockEditJson.mockResolvedValue(undefined);
  mockWriteJson.mockResolvedValue(undefined);
  mockReadJson.mockResolvedValue({});
});

describe('getPackageJsonPath', () => {
  it('should resolve package.json path from root', () => {
    const result = getPackageJsonPath();
    expect(result).toBe('/root/package.json');
  });

  it('should throw when root is not found', () => {
    mockResolvePathFromRoot.mockReturnValue(null);
    expect(() => getPackageJsonPath()).toThrow('Could not determine the package.json path');
  });
});

describe('getPackageLockJsonPath', () => {
  it('should resolve package-lock.json path from root', () => {
    const result = getPackageLockJsonPath();
    expect(result).toBe('/root/package-lock.json');
  });

  it('should throw when root is not found', () => {
    mockResolvePathFromRoot.mockReturnValue(null);
    expect(() => getPackageLockJsonPath()).toThrow('Could not determine the package-lock.json path');
  });
});

describe('getNpmShrinkWrapJsonPath', () => {
  it('should resolve npm-shrinkwrap.json path from root', () => {
    const result = getNpmShrinkWrapJsonPath();
    expect(result).toBe('/root/npm-shrinkwrap.json');
  });

  it('should throw when root is not found', () => {
    mockResolvePathFromRoot.mockReturnValue(null);
    expect(() => getNpmShrinkWrapJsonPath()).toThrow('Could not determine the npm-shrinkwrap.json path');
  });
});

describe('readPackageJson', () => {
  it('should read and return package.json', async () => {
    mockReadJson.mockResolvedValue({ name: 'test-pkg' });
    const result = await readPackageJson();
    expect(result).toEqual({ name: 'test-pkg' });
    expect(mockReadJson).toHaveBeenCalledWith('/root/package.json');
  });
});

describe('readPackageJsonSync', () => {
  it('should read and return package.json synchronously', () => {
    mockReadJsonSync.mockReturnValue({ name: 'sync-pkg' });
    const result = readPackageJsonSync();
    expect(result).toEqual({ name: 'sync-pkg' });
    expect(mockReadJsonSync).toHaveBeenCalledWith('/root/package.json');
  });
});

describe('writePackageJson', () => {
  it('should write package.json', async () => {
    await writePackageJson({ name: 'test' });
    expect(mockWriteJson).toHaveBeenCalledWith('/root/package.json', { name: 'test' });
  });
});

describe('writePackageJsonSync', () => {
  it('should write package.json synchronously', () => {
    writePackageJsonSync({ name: 'test' });
    expect(mockWriteJsonSync).toHaveBeenCalledWith('/root/package.json', { name: 'test' });
  });
});

describe('editPackageJson', () => {
  it('should call editJson with resolved path', async () => {
    const editFn = vi.fn();
    await editPackageJson(editFn);
    expect(mockEditJson).toHaveBeenCalledWith('/root/package.json', editFn, expect.any(Object));
  });

  it('should pass shouldSkipIfMissing option', async () => {
    const editFn = vi.fn();
    await editPackageJson(editFn, { shouldSkipIfMissing: true });
    expect(mockEditJson).toHaveBeenCalledWith(
      '/root/package.json',
      editFn,
      expect.objectContaining({ shouldSkipIfMissing: true })
    );
  });
});

describe('editPackageJsonSync', () => {
  it('should call editJsonSync with resolved path', () => {
    const editFn = vi.fn();
    editPackageJsonSync(editFn);
    expect(mockEditJsonSync).toHaveBeenCalledWith('/root/package.json', editFn, expect.any(Object));
  });
});

describe('readPackageLockJson', () => {
  it('should read package-lock.json', async () => {
    mockReadJson.mockResolvedValue({ lockfileVersion: 3 });
    const result = await readPackageLockJson();
    expect(result).toEqual({ lockfileVersion: 3 });
    expect(mockReadJson).toHaveBeenCalledWith('/root/package-lock.json');
  });
});

describe('readPackageLockJsonSync', () => {
  it('should read package-lock.json synchronously', () => {
    mockReadJsonSync.mockReturnValue({ lockfileVersion: 3 });
    const result = readPackageLockJsonSync();
    expect(result).toEqual({ lockfileVersion: 3 });
  });
});

describe('writePackageLockJson', () => {
  it('should write package-lock.json', async () => {
    await writePackageLockJson({ lockfileVersion: 3 });
    expect(mockWriteJson).toHaveBeenCalledWith('/root/package-lock.json', { lockfileVersion: 3 });
  });
});

describe('writePackageLockJsonSync', () => {
  it('should write package-lock.json synchronously', () => {
    writePackageLockJsonSync({ lockfileVersion: 3 });
    expect(mockWriteJsonSync).toHaveBeenCalledWith('/root/package-lock.json', { lockfileVersion: 3 });
  });
});

describe('editPackageLockJson', () => {
  it('should call editJson with resolved path', async () => {
    const editFn = vi.fn();
    await editPackageLockJson(editFn);
    expect(mockEditJson).toHaveBeenCalledWith('/root/package-lock.json', editFn, expect.any(Object));
  });
});

describe('editPackageLockJsonSync', () => {
  it('should call editJsonSync with resolved path', () => {
    const editFn = vi.fn();
    editPackageLockJsonSync(editFn);
    expect(mockEditJsonSync).toHaveBeenCalledWith('/root/package-lock.json', editFn, expect.any(Object));
  });
});

describe('editNpmShrinkWrapJson', () => {
  it('should call editJson with resolved npm-shrinkwrap.json path', async () => {
    const editFn = vi.fn();
    await editNpmShrinkWrapJson(editFn);
    expect(mockEditJson).toHaveBeenCalledWith('/root/npm-shrinkwrap.json', editFn, expect.any(Object));
  });
});
