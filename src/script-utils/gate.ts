/**
 * @file
 *
 * The branch gate: the verification sequence that `updateVersion` runs as its release preflight, available
 * as a command of its own.
 *
 * Four of the preflight's checks — `format:check`, `spellcheck`, `find-overexposed` and `test:coverage` —
 * are reachable by no other routine command. So the natural branch gate (build, lint, test) can be green
 * while the release is still going to fail, and the failure arrives at release time rather than in seconds
 * on the branch.
 *
 * This module exists so the two are the same code rather than two lists that agree today: `updateVersion`
 * calls {@link gate}, and a check added here is reachable from both. What the gate deliberately leaves to
 * the release path is the clean-repo assertion — a branch gate is run on a dirty tree, which is the whole
 * point of running it before committing — and the integration suite, which is the one preflight step that
 * already has a routine command of its own (`npm run test:integration`) and so is not in the class this
 * module exists for.
 *
 * The tests run ONCE, through `test:coverage` where the project defines it and through `test` otherwise.
 * Running both, as this did until 2026-09-05, was a duplicate everywhere it mattered: a project scopes its
 * two test scripts to the same vitest projects — every repo in this workspace passes the same `projects`
 * array to both — so `test:coverage` is `test` plus the threshold flags, over the identical files. It buys
 * no fail-fast either, because the coverage run fails on exactly the failures the plain run would have
 * caught. The one thing lost is the ability to switch off only the coverage half: `TEST_COVERAGE=0` now
 * turns off the gate's whole test step rather than demoting it to `test`.
 */

import { parseArgs } from 'node:util';

import { isEnvVariableOff } from './env-toggle.ts';
import {
  npmRun,
  npmRunOptional,
  NpmRunOptionalResult
} from './npm-run.ts';
import { assertPackageLockIntegrity } from './package-lock-integrity.ts';

/**
 * The off switch for the lockfile check. The check is no npm script, so npm cannot derive a switch from a
 * script name for it, but the name follows the same pattern.
 */
const PACKAGE_LOCK_INTEGRITY_ENV_VARIABLE = 'PACKAGE_LOCK_INTEGRITY';

/**
 * Options for {@link gate}.
 */
export interface GateOptions {
  /**
   * Whether to run the build. The build is not a verification check — it is kept in the gate because it is
   * the only step that type-checks the project, and a green lint is not a type-check.
   *
   * @default `true`
   */
  readonly shouldBuild?: boolean;

  /**
   * Whether to run the verification checks. When `false`, only the build runs, which is what
   * `npm run version -- --no-checks` does.
   *
   * @default `true`
   */
  readonly shouldRunChecks?: boolean;

  /**
   * Whether to run the integration test suite. Off by default, on two reasons that are about COST rather
   * than about contention — desktop runs stopped contending in `obsidian-integration-testing` 5.0.0, which
   * gives every run its own user-data dir and CDP port, and the Android emulator that is still shared is
   * serialized by that package's own `android` setup lock, which waits rather than failing.
   *
   * The reasons that do hold: `test:integration` is the one preflight step reachable by a routine command
   * of its own, unlike the four this gate exists for; and in a project whose suite includes an Android
   * test it boots an AVD and an Appium server, then queues behind any other Android run for up to that
   * lock's hour-long acquisition timeout. A command whose whole selling point is answering in seconds must
   * not start one unasked. The release path opts in, so nothing is skipped before a publish.
   *
   * @default `false`
   */
  readonly shouldRunIntegrationTests?: boolean;
}

/**
 * Runs the verification sequence that `npm run version` runs as its preflight.
 *
 * The order is deliberate. The lockfile check ({@link assertPackageLockIntegrity}) comes first, because it
 * is an in-process JSON read that takes well under a second. Then come the checks that finish in seconds (`format:check`, `spellcheck`, `lint:md`) run
 * first, so a typo fails the gate immediately instead of after the coverage run. Each step is dispatched
 * through the package manager, so a project overriding one of these scripts gets its own version, and each
 * step carries its own environment off switch.
 *
 * Every step but `build` is run with {@link npmRunOptional}, so it is skipped when the project does not define
 * it: a project that chose no formatter, spell checker, markdown linter or linter has nothing to check there,
 * and requiring those scripts made `npm run version` die on its first step in exactly those projects. `build`
 * stays required, because a release with nothing built has nothing to ship. The test step is the one place that reads that skip: `test:coverage` is preferred, and
 * `test` runs only as its fallback, so the suite is never run twice. The unit tests stay ahead of
 * `test:integration` for the same fastest-first reason — a broken unit test should fail before an
 * integration suite is started, not after.
 *
 * @param options - The {@link GateOptions} controlling which steps run.
 * @returns A {@link Promise} that resolves when every step has passed.
 */
export async function gate(options: GateOptions = {}): Promise<void> {
  const {
    shouldBuild = true,
    shouldRunChecks = true,
    shouldRunIntegrationTests = false
  } = options;

  if (shouldRunChecks) {
    if (!isEnvVariableOff(PACKAGE_LOCK_INTEGRITY_ENV_VARIABLE)) {
      await assertPackageLockIntegrity();
    }

    await npmRunOptional('format:check');
    await npmRunOptional('spellcheck');
    await npmRunOptional('lint:md');
  }

  if (shouldBuild) {
    await npmRun('build');
  }

  if (!shouldRunChecks) {
    return;
  }

  await npmRunOptional('lint');
  await npmRunOptional('find-overexposed');

  if (await npmRunOptional('test:coverage') === NpmRunOptionalResult.Skipped) {
    await npmRunOptional('test');
  }

  if (shouldRunIntegrationTests) {
    await npmRunOptional('test:integration');
  }
}

/**
 * Parses the command-line arguments for the gate script.
 *
 * The two `--no-` flags switch off steps that are on; `--integration` is the one that switches a step ON,
 * because {@link GateOptions.shouldRunIntegrationTests} is off by default for cost. It exists so that
 * default is a choice the caller can make per run rather than one only a programmatic caller can reach.
 *
 * @param $arguments - The command-line arguments to parse.
 * @returns The parsed {@link GateOptions}.
 */
export function parseGateArguments($arguments: string[]): GateOptions {
  const { values } = parseArgs({
    // eslint-disable-next-line unicorn/name-replacements -- `args` is the option name Node's `parseArgs` reads.
    args: $arguments,
    options: {
      'integration': { type: 'boolean' },
      'no-build': { type: 'boolean' },
      'no-checks': { type: 'boolean' }
    }
  });

  return {
    shouldBuild: !(values['no-build'] ?? false),
    shouldRunChecks: !(values['no-checks'] ?? false),
    shouldRunIntegrationTests: values.integration ?? false
  };
}
