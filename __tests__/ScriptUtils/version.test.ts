import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  getNewVersion,
  getVersionUpdateType,
  validate,
  VersionUpdateType
} from '../../src/ScriptUtils/version.ts';

const { mockReadPackageJson } = vi.hoisted(() => ({
  mockReadPackageJson: vi.fn()
}));

vi.mock('../../src/ScriptUtils/Npm.ts', () => ({
  readPackageJson: mockReadPackageJson
}));

vi.mock('../../src/Debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

beforeEach(() => {
  vi.resetAllMocks();
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
