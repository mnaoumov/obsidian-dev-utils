/**
 * @packageDocumentation
 *
 * This module provides functions for running tests using the Vitest framework.
 */

/* v8 ignore start -- Executes vitest as a CLI subprocess; correctness is verified by running tests, not unit tests. */

import { execFromRoot } from '../root.ts';

/**
 * Parameters for running tests with coverage.
 */
export interface TestCoverageParams extends TestParams {
  /**
   * Minimum coverage percentage required. If the actual coverage falls below
   * this threshold, the process exits with a non-zero code.
   */
  minCoverageInPercents?: number;
}

/**
 * Parameters for running tests.
 */
export interface TestParams {
  /**
   * The projects to run.
   */
  projects?: string[];
}

/**
 * Runs the test suite.
 *
 * @param params - The parameters for the test.
 * @returns A {@link Promise} that resolves when the tests have completed.
 */
export async function test(params: TestParams = {}): Promise<void> {
  await execFromRoot(['vitest', 'run', ...buildProjectFlags(params.projects)]);
}

/**
 * Runs the test suite with coverage.
 *
 * @param params - Optional coverage configuration.
 * @returns A {@link Promise} that resolves when the tests have completed.
 */
export async function testCoverage(params: TestCoverageParams = {}): Promise<void> {
  const threshold = String(params.minCoverageInPercents ?? 0);
  await execFromRoot([
    'vitest',
    'run',
    ...buildProjectFlags(params.projects),
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
 * @param params - The parameters for the test.
 * @returns A {@link Promise} that resolves when the tests have completed.
 */
export async function testWatch(params: TestParams = {}): Promise<void> {
  await execFromRoot(['vitest', ...buildProjectFlags(params.projects)]);
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
