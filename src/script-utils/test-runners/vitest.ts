/**
 * @packageDocumentation
 *
 * This module provides functions for running tests using the Vitest framework.
 */

/* v8 ignore start -- Executes vitest as a CLI subprocess; correctness is verified by running tests, not unit tests. */

import { execFromRoot } from '../root.ts';

/**
 * Options for running tests with coverage.
 */
export interface TestCoverageOptions {
  /**
   * Minimum coverage percentage required. If the actual coverage falls below
   * this threshold, the process exits with a non-zero code.
   */
  minCoverage?: number;
}

/**
 * Runs the test suite.
 *
 * @returns A {@link Promise} that resolves when the tests have completed.
 */
export async function test(): Promise<void> {
  await execFromRoot('vitest run');
}

/**
 * Runs the test suite with coverage.
 *
 * @param options - Optional coverage configuration.
 * @returns A {@link Promise} that resolves when the tests have completed.
 */
export async function testCoverage(options?: TestCoverageOptions): Promise<void> {
  const threshold = String(options?.minCoverage ?? 0);
  await execFromRoot(
    `vitest run --coverage --coverage.thresholds.lines=${threshold} --coverage.thresholds.functions=${threshold} --coverage.thresholds.branches=${threshold} --coverage.thresholds.statements=${threshold}`
  );
}

/**
 * Runs the test suite in watch mode.
 *
 * @returns A {@link Promise} that resolves when the tests have completed.
 */
export async function testWatch(): Promise<void> {
  await execFromRoot('vitest');
}

/* v8 ignore stop */
