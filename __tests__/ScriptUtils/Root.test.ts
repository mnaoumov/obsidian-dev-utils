import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  getRootFolder,
  resolvePathFromRoot,
  resolvePathFromRootSafe,
  toRelativeFromRoot
} from '../../src/ScriptUtils/Root.ts';

const { mockExistsSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn<(path: string) => boolean>()
}));

vi.mock('../../src/ScriptUtils/NodeModules.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/ScriptUtils/NodeModules.ts')>();
  return {
    ...mod,
    existsSync: mockExistsSync
  };
});

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
