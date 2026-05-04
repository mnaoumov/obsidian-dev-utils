/**
 * @file
 *
 * Vitest global setup for Obsidian integration tests.
 *
 * 1. Builds the integration test harness plugin into `dist/dev/`.
 * 2. Delegates to `obsidian-integration-testing`'s global setup which
 *    creates a temp vault, installs the plugin, and enables it.
 */

import type { TestProject } from 'vitest/node';

import {
  setup as integrationSetup,
  teardown as integrationTeardown
} from 'obsidian-integration-testing/vitest-global-setup';

import { buildIntegrationTestPlugin } from './helpers/build-integration-test-plugin.ts';

/**
 * Vitest global setup.
 *
 * @param project - The Vitest test project.
 */
export async function setup(project: TestProject): Promise<void> {
  await buildIntegrationTestPlugin();
  await integrationSetup(project);
}

/**
 * Vitest global teardown.
 */
export async function teardown(): Promise<void> {
  await integrationTeardown();
}
