/**
 * @packageDocumentation
 *
 * This module provides functions for running tests using the Vitest framework.
 */

import { execFromRoot } from '../root.ts';

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
 * @returns A {@link Promise} that resolves when the tests have completed.
 */
export async function testCoverage(): Promise<void> {
  await execFromRoot('vitest run --coverage');
}

/**
 * Runs the test suite in watch mode.
 *
 * @returns A {@link Promise} that resolves when the tests have completed.
 */
export async function testWatch(): Promise<void> {
  await execFromRoot('vitest');
}
