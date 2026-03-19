/**
 * @packageDocumentation
 *
 * This module provides functions for running tests using the Vitest framework.
 */

/* v8 ignore start -- Executes vitest as a CLI subprocess; correctness is verified by running tests, not unit tests. */

import { execFromRoot } from '../root.ts';

/**
 * The vitest project name glob that matches all unit test projects.
 */
const UNIT_TESTS_PROJECT_GLOB = 'unit-tests:*';

/**
 * The vitest project name for integration tests.
 */
const INTEGRATION_TESTS_PROJECT = 'integration-tests';

/**
 * Options for running tests with coverage.
 */
export interface TestCoverageOptions {
  /**
   * Minimum coverage percentage required. If the actual coverage falls below
   * this threshold, the process exits with a non-zero code.
   */
  minCoverageInPercents?: number;
}

/**
 * Runs the unit test suite.
 *
 * @returns A {@link Promise} that resolves when the tests have completed.
 */
export async function test(): Promise<void> {
  await execFromRoot(`vitest run --project=${UNIT_TESTS_PROJECT_GLOB}`);
}

/**
 * Runs the unit test suite with coverage.
 *
 * @param options - Optional coverage configuration.
 * @returns A {@link Promise} that resolves when the tests have completed.
 */
export async function testCoverage(options?: TestCoverageOptions): Promise<void> {
  const threshold = String(options?.minCoverageInPercents ?? 0);
  await execFromRoot(
    `vitest run --project=${UNIT_TESTS_PROJECT_GLOB} --coverage --coverage.thresholds.lines=${threshold} --coverage.thresholds.functions=${threshold} --coverage.thresholds.branches=${threshold} --coverage.thresholds.statements=${threshold}`
  );
}

/**
 * Runs the integration test suite.
 *
 * @returns A {@link Promise} that resolves when the tests have completed.
 */
export async function testIntegration(): Promise<void> {
  await execFromRoot(`vitest run --project=${INTEGRATION_TESTS_PROJECT}`);
}

/**
 * Runs the unit test suite in watch mode.
 *
 * @returns A {@link Promise} that resolves when the tests have completed.
 */
export async function testWatch(): Promise<void> {
  await execFromRoot(`vitest --project=${UNIT_TESTS_PROJECT_GLOB}`);
}

/* v8 ignore stop */
