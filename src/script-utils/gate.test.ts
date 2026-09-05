import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noopAsync } from '../function.ts';
import {
  gate,
  parseGateArguments
} from './gate.ts';

const {
  mockNpmRun,
  mockNpmRunOptional
} = vi.hoisted(() => ({
  mockNpmRun: vi.fn<(script: string) => Promise<void>>(),
  mockNpmRunOptional: vi.fn<(script: string) => Promise<void>>()
}));

vi.mock('./npm-run.ts', () => ({
  npmRun: mockNpmRun,
  npmRunOptional: mockNpmRunOptional
}));

/**
 * The scripts the gate ran, in the order it ran them, regardless of which of the two runners dispatched
 * each one. The order across the two runners is what most of these assertions are about, so it is recorded
 * as the calls happen rather than reconstructed from two separate call lists afterwards.
 */
let ranScripts: string[] = [];

beforeEach(() => {
  vi.resetAllMocks();
  ranScripts = [];
  mockNpmRun.mockImplementation((script: string) => {
    ranScripts.push(script);
    return noopAsync();
  });
  mockNpmRunOptional.mockImplementation((script: string) => {
    ranScripts.push(script);
    return noopAsync();
  });
});

describe('gate', () => {
  it('should run the whole preflight sequence in order by default', async () => {
    await gate();
    expect(ranScripts).toEqual([
      'format:check',
      'spellcheck',
      'lint:md',
      'build',
      'lint',
      'find-overexposed',
      'test',
      'test:coverage'
    ]);
  });

  it('should require the always-defined scripts and treat the rest as optional', async () => {
    await gate();
    expect(mockNpmRun.mock.calls.map((call) => call[0])).toEqual([
      'format:check',
      'spellcheck',
      'lint:md',
      'build',
      'lint'
    ]);
    expect(mockNpmRunOptional.mock.calls.map((call) => call[0])).toEqual([
      'find-overexposed',
      'test',
      'test:coverage'
    ]);
  });

  it('should run only the build when shouldRunChecks is false', async () => {
    await gate({ shouldRunChecks: false });
    expect(ranScripts).toEqual(['build']);
  });

  it('should run the checks but not the build when shouldBuild is false', async () => {
    await gate({ shouldBuild: false });
    expect(ranScripts).toEqual([
      'format:check',
      'spellcheck',
      'lint:md',
      'lint',
      'find-overexposed',
      'test',
      'test:coverage'
    ]);
  });

  it('should run nothing when both the checks and the build are off', async () => {
    await gate({
      shouldBuild: false,
      shouldRunChecks: false
    });
    expect(ranScripts).toEqual([]);
  });

  it('should run the integration suite between the unit tests and coverage when asked', async () => {
    await gate({ shouldRunIntegrationTests: true });
    expect(ranScripts).toEqual([
      'format:check',
      'spellcheck',
      'lint:md',
      'build',
      'lint',
      'find-overexposed',
      'test',
      'test:integration',
      'test:coverage'
    ]);
  });

  it('should not run the integration suite when the checks are off', async () => {
    await gate({
      shouldRunChecks: false,
      shouldRunIntegrationTests: true
    });
    expect(ranScripts).toEqual(['build']);
  });

  it('should propagate a failing step and skip the rest', async () => {
    mockNpmRun.mockImplementation((script: string) => {
      ranScripts.push(script);
      return script === 'spellcheck' ? Promise.reject(new Error('Unknown word')) : noopAsync();
    });
    await expect(gate()).rejects.toThrow('Unknown word');
    expect(ranScripts).toEqual(['format:check', 'spellcheck']);
  });
});

describe('parseGateArguments', () => {
  it('should enable the build and the checks when no flags are passed', () => {
    expect(parseGateArguments([])).toEqual({
      shouldBuild: true,
      shouldRunChecks: true
    });
  });

  it('should turn off the build for --no-build', () => {
    expect(parseGateArguments(['--no-build'])).toEqual({
      shouldBuild: false,
      shouldRunChecks: true
    });
  });

  it('should turn off the checks for --no-checks', () => {
    expect(parseGateArguments(['--no-checks'])).toEqual({
      shouldBuild: true,
      shouldRunChecks: false
    });
  });

  it('should accept both flags together', () => {
    expect(parseGateArguments(['--no-build', '--no-checks'])).toEqual({
      shouldBuild: false,
      shouldRunChecks: false
    });
  });
});
