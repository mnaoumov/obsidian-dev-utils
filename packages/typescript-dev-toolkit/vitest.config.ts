import { defineConfig } from 'vitest/config';

import {
  WORKSPACE_COVERAGE,
  WORKSPACE_TEST_EXCLUDE,
  WORKSPACE_VITEST_REPORTERS,
  workspaceSourcePlugin
} from '../../scripts/vitest-workspace.ts';

const ESLINT_TYPECHECK_TEST_FILES = 'src/linters/eslint-rules/*.test.ts';
const INTEGRATION_TEST_FILES = 'src/**/*.integration.test.ts';

// Every `@typescript-eslint/rule-tester` case builds a type-aware program, so these run one file at a time in a
// shared worker; see AGENTS.md on why a timeout here is machine load rather than a broken rule.
const ESLINT_TYPECHECK_GROUP_ORDER = 1;
const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;

export default defineConfig({
  plugins: [workspaceSourcePlugin()],
  test: {
    coverage: WORKSPACE_COVERAGE,
    exclude: WORKSPACE_TEST_EXCLUDE,
    globals: false,
    onConsoleLog: (): false => false,
    projects: [
      {
        test: {
          environment: 'node',
          exclude: [...WORKSPACE_TEST_EXCLUDE, INTEGRATION_TEST_FILES, ESLINT_TYPECHECK_TEST_FILES],
          include: ['src/**/*.test.ts'],
          name: 'unit-tests',
          setupFiles: []
        }
      },
      {
        test: {
          environment: 'node',
          exclude: WORKSPACE_TEST_EXCLUDE,
          include: [ESLINT_TYPECHECK_TEST_FILES],
          isolate: false,
          maxWorkers: 1,
          name: 'unit-tests:eslint-typecheck',
          sequence: {
            groupOrder: ESLINT_TYPECHECK_GROUP_ORDER
          },
          setupFiles: []
        }
      },
      {
        test: {
          environment: 'node',
          exclude: WORKSPACE_TEST_EXCLUDE,
          include: [INTEGRATION_TEST_FILES],
          name: 'integration-tests',
          setupFiles: [],
          testTimeout: BIG_TIMEOUT_IN_MILLISECONDS
        }
      }
    ],
    reporters: WORKSPACE_VITEST_REPORTERS
  }
});
