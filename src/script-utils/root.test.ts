import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  execFromRoot,
  getRootFolder,
  resolvePathFromRoot,
  resolvePathFromRootSafe,
  toRelativeFromRoot
} from './root.ts';

const {
  mockExec,
  mockExistsSync
} = vi.hoisted(() => ({
  mockExec: vi.fn(),
  mockExistsSync: vi.fn<(path: string) => boolean>()
}));

vi.mock('node:fs', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:fs')>();
  return {
    ...mod,
    existsSync: mockExistsSync
  };
});

vi.mock('../script-utils/exec.ts', () => ({
  exec: mockExec
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getRootFolder', () => {
  it('should return the folder containing package.json', () => {
    mockExistsSync.mockImplementation((p: string) => p === 'C:/project/package.json');
    const result = getRootFolder('C:/project/src/deep');
    expect(result).toBe('C:/project');
  });

  it('should return null when no package.json found', () => {
    mockExistsSync.mockReturnValue(false);
    const result = getRootFolder('C:/no/project/here');
    expect(result).toBeNull();
  });

  it('should find package.json in the cwd itself', () => {
    mockExistsSync.mockImplementation((p: string) => p === 'C:/project/package.json');
    const result = getRootFolder('C:/project');
    expect(result).toBe('C:/project');
  });
});

describe('resolvePathFromRoot', () => {
  it('should resolve a path relative to root', () => {
    mockExistsSync.mockImplementation((p: string) => p === 'C:/project/package.json');
    const result = resolvePathFromRoot('dist/index.js', 'C:/project/src');
    expect(result).toContain('dist');
    expect(result).toContain('index.js');
  });

  it('should return null when root is not found', () => {
    mockExistsSync.mockReturnValue(false);
    const result = resolvePathFromRoot('dist/index.js', 'C:/no/root');
    expect(result).toBeNull();
  });
});

describe('resolvePathFromRootSafe', () => {
  it('should resolve path when root is found', () => {
    mockExistsSync.mockImplementation((p: string) => p === 'C:/project/package.json');
    const result = resolvePathFromRootSafe('dist/index.js', 'C:/project');
    expect(result).toContain('dist');
    expect(result).toContain('index.js');
  });

  it('should return original path when root is not found', () => {
    mockExistsSync.mockReturnValue(false);
    const result = resolvePathFromRootSafe('some/path.ts', 'C:/no/root');
    expect(result).toBe('some/path.ts');
  });
});

describe('toRelativeFromRoot', () => {
  it('should convert absolute path to relative from root', () => {
    mockExistsSync.mockImplementation((p: string) => p === 'C:/project/package.json');
    const result = toRelativeFromRoot('C:/project/src/file.ts', 'C:/project');
    expect(result).toBe('src/file.ts');
  });

  it('should return null when root is not found', () => {
    mockExistsSync.mockReturnValue(false);
    const result = toRelativeFromRoot('C:/some/file.ts', 'C:/no/root');
    expect(result).toBeNull();
  });
});

describe('execFromRoot', () => {
  beforeEach(() => {
    mockExec.mockResolvedValue('output');
  });

  it('should execute command from root folder', async () => {
    mockExistsSync.mockImplementation((p: string) => p === 'C:/project/package.json');
    await execFromRoot('echo hello', { cwd: 'C:/project/src' });
    expect(mockExec).toHaveBeenCalledWith('echo hello', expect.objectContaining({ cwd: 'C:/project', shouldIncludeDetails: false }));
  });

  it('should throw when root is not found and shouldFailIfCalledFromOutsideRoot defaults to true', () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => execFromRoot('echo hello', { cwd: 'C:/no/root' })).toThrow('Could not find root folder');
  });

  it('should throw when root is not found and shouldFailIfCalledFromOutsideRoot is true', () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => execFromRoot('echo hello', { cwd: 'C:/no/root', shouldFailIfCalledFromOutsideRoot: true })).toThrow('Could not find root folder');
  });

  it('should use cwd when root is not found and shouldFailIfCalledFromOutsideRoot is false', async () => {
    mockExistsSync.mockReturnValue(false);
    await execFromRoot('echo hello', { cwd: 'C:/fallback', shouldFailIfCalledFromOutsideRoot: false });
    expect(mockExec).toHaveBeenCalledWith('echo hello', expect.objectContaining({ cwd: 'C:/fallback' }));
  });

  it('should fall back to process.cwd when root not found and no cwd provided', async () => {
    mockExistsSync.mockReturnValue(false);
    await execFromRoot('echo hello', { shouldFailIfCalledFromOutsideRoot: false });
    expect(mockExec).toHaveBeenCalledTimes(1);
  });

  it('should pass shouldIncludeDetails: true when option is set', async () => {
    mockExistsSync.mockImplementation((p: string) => p === 'C:/project/package.json');
    await execFromRoot('echo hello', { cwd: 'C:/project', shouldIncludeDetails: true });
    expect(mockExec).toHaveBeenCalledWith('echo hello', expect.objectContaining({ shouldIncludeDetails: true }));
  });

  it('should pass shouldIncludeDetails: false when option is not set', async () => {
    mockExistsSync.mockImplementation((p: string) => p === 'C:/project/package.json');
    await execFromRoot('echo hello', { cwd: 'C:/project' });
    expect(mockExec).toHaveBeenCalledWith('echo hello', expect.objectContaining({ shouldIncludeDetails: false }));
  });
});
