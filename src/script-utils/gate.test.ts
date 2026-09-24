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
import { NpmRunOptionalResult } from './npm-run.ts';

const {
  mockAssertPackageLockIntegrity,
  mockNpmRun,
  mockNpmRunOptional
} = vi.hoisted(() => ({
  mockAssertPackageLockIntegrity: vi.fn<() => Promise<void>>(),
  mockNpmRun: vi.fn<(script: string) => Promise<void>>(),
  mockNpmRunOptional: vi.fn<(script: string) => Promise<NpmRunOptionalResult>>()
}));

vi.mock('./npm-run.ts', async (importOriginal) => {
  const $module = await importOriginal<typeof import('./npm-run.ts')>();
  return {
    ...$module,
    npmRun: mockNpmRun,
    npmRunOptional: mockNpmRunOptional
  };
});

vi.mock('./package-lock-integrity.ts', () => ({
  assertPackageLockIntegrity: mockAssertPackageLockIntegrity
}));

/**
 * The scripts the gate ran, in the order it ran them, regardless of which of the two runners dispatched
 * each one. The order across the two runners is what most of these assertions are about, so it is recorded
 * as the calls happen rather than reconstructed from two separate call lists afterwards.
 */
let ranScripts: string[] = [];

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  ranScripts = [];
  mockAssertPackageLockIntegrity.mockImplementation(noopAsync);
  mockNpmRun.mockImplementation((script: string) => {
    ranScripts.push(script);
    return noopAsync();
  });
  mockNpmRunOptional.mockImplementation((script: string) => {
    ranScripts.push(script);
    return Promise.resolve(NpmRunOptionalResult.Success);
  });
});

/**
 * Makes {@link mockNpmRunOptional} report the given scripts as absent from the project's `package.json`,
 * exactly as {@link npmRunOptional} does. The scripts are still recorded in {@link ranScripts}, because the
 * gate did try to run them — what the caller is asserting is what the gate does NEXT with that answer.
 *
 * @param skippedScripts - The scripts to report as not defined.
 */
function skipScripts(...skippedScripts: string[]): void {
  mockNpmRunOptional.mockImplementation((script: string) => {
    ranScripts.push(script);
    return Promise.resolve(skippedScripts.includes(script) ? NpmRunOptionalResult.Skipped : NpmRunOptionalResult.Success);
  });
}

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
      'test:coverage'
    ]);
  });

  it('should require only the build and treat every check as optional', async () => {
    await gate();
    expect(mockNpmRun.mock.calls.map((call) => call[0])).toEqual(['build']);
    expect(mockNpmRunOptional.mock.calls.map((call) => call[0])).toEqual([
      'format:check',
      'spellcheck',
      'lint:md',
      'lint',
      'find-overexposed',
      'test:coverage'
    ]);
  });

  // A project that chose no formatter, spell checker, markdown linter or linter has none of those scripts, and
  // `npm run version` used to die on the first one it lacked. Skipping one must not end the gate early either.
  it('should carry on past every check the project does not define', async () => {
    skipScripts('format:check', 'spellcheck', 'lint:md', 'lint');
    await gate();
    expect(ranScripts).toEqual([
      'format:check',
      'spellcheck',
      'lint:md',
      'build',
      'lint',
      'find-overexposed',
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

  it('should run the integration suite after the unit tests when asked', async () => {
    await gate({ shouldRunIntegrationTests: true });
    expect(ranScripts).toEqual([
      'format:check',
      'spellcheck',
      'lint:md',
      'build',
      'lint',
      'find-overexposed',
      'test:coverage',
      'test:integration'
    ]);
  });

  it('should fall back to test when the project defines no test:coverage', async () => {
    skipScripts('test:coverage');
    await gate();
    expect(ranScripts).toEqual([
      'format:check',
      'spellcheck',
      'lint:md',
      'build',
      'lint',
      'find-overexposed',
      'test:coverage',
      'test'
    ]);
  });

  it('should still run the integration suite after the test fallback', async () => {
    skipScripts('test:coverage');
    await gate({ shouldRunIntegrationTests: true });
    expect(ranScripts.slice(-3)).toEqual([
      'test:coverage',
      'test',
      'test:integration'
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
    mockNpmRunOptional.mockImplementation((script: string) => {
      ranScripts.push(script);
      return script === 'spellcheck' ? Promise.reject(new Error('Unknown word')) : Promise.resolve(NpmRunOptionalResult.Success);
    });
    await expect(gate()).rejects.toThrow('Unknown word');
    expect(ranScripts).toEqual(['format:check', 'spellcheck']);
  });
});

describe('gate lockfile check', () => {
  it('should check the lockfile before the first script', async () => {
    await gate();
    expect(mockAssertPackageLockIntegrity).toHaveBeenCalledOnce();
    const [lockCheckOrder] = mockAssertPackageLockIntegrity.mock.invocationCallOrder;
    const [firstScriptOrder] = mockNpmRunOptional.mock.invocationCallOrder;
    expect(lockCheckOrder).toBeLessThan(firstScriptOrder ?? 0);
  });

  it('should not check the lockfile when the checks are off', async () => {
    await gate({ shouldRunChecks: false });
    expect(mockAssertPackageLockIntegrity).not.toHaveBeenCalled();
  });

  it('should not check the lockfile when PACKAGE_LOCK_INTEGRITY is off', async () => {
    vi.stubEnv('PACKAGE_LOCK_INTEGRITY', '0');
    await gate();
    expect(mockAssertPackageLockIntegrity).not.toHaveBeenCalled();
    expect(ranScripts[0]).toBe('format:check');
  });

  it('should run no script when the lockfile check fails', async () => {
    mockAssertPackageLockIntegrity.mockRejectedValue(new Error('no integrity'));
    await expect(gate()).rejects.toThrow('no integrity');
    expect(ranScripts).toEqual([]);
  });
});

describe('parseGateArguments', () => {
  it('should enable the build and the checks but not the integration suite when no flags are passed', () => {
    expect(parseGateArguments([])).toEqual({
      shouldBuild: true,
      shouldRunChecks: true,
      shouldRunIntegrationTests: false
    });
  });

  it('should turn off the build for --no-build', () => {
    expect(parseGateArguments(['--no-build'])).toEqual({
      shouldBuild: false,
      shouldRunChecks: true,
      shouldRunIntegrationTests: false
    });
  });

  it('should turn off the checks for --no-checks', () => {
    expect(parseGateArguments(['--no-checks'])).toEqual({
      shouldBuild: true,
      shouldRunChecks: false,
      shouldRunIntegrationTests: false
    });
  });

  it('should turn on the integration suite for --integration', () => {
    expect(parseGateArguments(['--integration'])).toEqual({
      shouldBuild: true,
      shouldRunChecks: true,
      shouldRunIntegrationTests: true
    });
  });

  it('should accept every flag together', () => {
    expect(parseGateArguments([
      '--no-build',
      '--no-checks',
      '--integration'
    ])).toEqual({
      shouldBuild: false,
      shouldRunChecks: false,
      shouldRunIntegrationTests: true
    });
  });
});
