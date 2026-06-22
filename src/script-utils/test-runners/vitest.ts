/**
 * @file
 *
 * This module provides functions for running tests using the Vitest framework.
 */

/* v8 ignore start -- Executes vitest as a CLI subprocess; correctness is verified by running tests, not unit tests. */

import { execFromRoot } from '../root.ts';

/**
 * Options for running tests with coverage.
 */
export interface TestCoverageOptions extends TestOptions {
  /**
   * Minimum coverage percentage required. If the actual coverage falls below
   * this threshold, the process exits with a non-zero code.
   */
  readonly minCoverageInPercents?: number;
}

/**
 * Options for running tests.
 */
export interface TestOptions {
  /**
   * The projects to run.
   */
  readonly projects?: string[];
}

/**
 * Options for running tests in watch mode.
 */
export type TestWatchOptions = TestOptions;

/**
 * Runs the test suite.
 *
 * @param options - The options for the test.
 * @returns A {@link Promise} that resolves when the tests have completed.
 */
export async function test(options: TestOptions = {}): Promise<void> {
  await execFromRoot(['vitest', 'run', ...buildProjectFlags(options.projects)]);
}

/**
 * Runs the test suite with coverage.
 *
 * @param options - Optional coverage configuration.
 * @returns A {@link Promise} that resolves when the tests have completed.
 */
export async function testCoverage(options: TestCoverageOptions = {}): Promise<void> {
  const threshold = String(options.minCoverageInPercents ?? 0);
  await execFromRoot([
    'vitest',
    'run',
    ...buildProjectFlags(options.projects),
    '--coverage',
    `--coverage.thresholds.lines=${threshold}`,
    `--coverage.thresholds.functions=${threshold}`,
    `--coverage.thresholds.branches=${threshold}`,
    `--coverage.thresholds.statements=${threshold}`
  ]);
}

/**
 * Runs the test suite in watch mode.
 *
 * @param options - The options for the test.
 * @returns A {@link Promise} that resolves when the tests have completed.
 */
export async function testWatch(options: TestWatchOptions = {}): Promise<void> {
  await execFromRoot(['vitest', ...buildProjectFlags(options.projects)]);
}

/**
 * Builds `--project` flags for the given project prefixes.
 * Each prefix expands to both `--project=prefix` (exact match)
 * and `--project=prefix:*` (sub-projects).
 *
 * @param projects - The project name prefixes.
 * @returns The `--project` flags array.
 */
function buildProjectFlags(projects?: string[]): string[] {
  return (projects ?? []).flatMap((project) => [`--project=${project}`, `--project=${project}:*`]);
}

/* v8 ignore stop */
