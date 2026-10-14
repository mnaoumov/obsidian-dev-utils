import { defineConfig } from 'vitest/config';

import {
  WORKSPACE_TEST_EXCLUDE,
  WORKSPACE_VITEST_REPORTERS,
  workspaceSourcePlugin
} from './vitest-workspace.ts';

/*
 * The root's OWN tests: the build scripts and the documentation site. Every package's tests live in that
 * package's `vitest.config.ts`; the root `test` / `test:coverage` scripts run this config, then each package's.
 */

const DOCS_GENERATOR_TEST_FILES = 'scripts/docs-gen/**/*.test.ts';
const DOCS_SITE_TEST_FILES = 'docs/src/**/*.test.ts';
const BUILD_SCRIPT_HELPERS_TEST_FILES = 'scripts/helpers/**/*.test.ts';

// Rendering an OG image to a bitmap (satori + resvg) and building a ts-morph Project are genuinely slow.
// Under the full aggregate they lose the CPU race and the default 5000 ms times them out.
const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;

export const config = defineConfig({
  plugins: [workspaceSourcePlugin()],
  test: {
    exclude: WORKSPACE_TEST_EXCLUDE,
    globals: false,
    onConsoleLog: (): false => false,
    projects: [
      {
        plugins: [workspaceSourcePlugin()],
        test: {
          environment: 'node',
          exclude: [...WORKSPACE_TEST_EXCLUDE],
          include: [BUILD_SCRIPT_HELPERS_TEST_FILES],
          name: 'unit-tests',
          setupFiles: []
        }
      },
      {
        plugins: [workspaceSourcePlugin()],
        test: {
          environment: 'node',
          exclude: [...WORKSPACE_TEST_EXCLUDE],
          include: [DOCS_GENERATOR_TEST_FILES, DOCS_SITE_TEST_FILES],
          name: 'unit-tests:docs-generator',
          setupFiles: [],
          testTimeout: BIG_TIMEOUT_IN_MILLISECONDS
        }
      }
    ],
    reporters: WORKSPACE_VITEST_REPORTERS
  }
});
