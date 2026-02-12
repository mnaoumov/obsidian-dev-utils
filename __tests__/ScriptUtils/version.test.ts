import {
  describe,
  expect,
  it
} from 'vitest';

import {
  getVersionUpdateType,
  validate,
  VersionUpdateType
} from '../../src/ScriptUtils/version.ts';

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
