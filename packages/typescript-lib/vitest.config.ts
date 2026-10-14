import { defineConfig } from 'vitest/config';

import {
  WORKSPACE_COVERAGE,
  WORKSPACE_TEST_EXCLUDE,
  WORKSPACE_VITEST_REPORTERS,
  workspaceSourcePlugin
} from '../../scripts/vitest-workspace.ts';

// The files that `vi.stubGlobal` a DOM global the VM pool cannot redefine. See the AGENTS.md section on
// `pool: 'vmThreads'`: they keep the default pool, in a sibling project.
const GLOBAL_STUB_TEST_FILES = [
  'src/abort-controller.test.ts',
  'src/async.test.ts',
  'src/blob.test.ts'
];

const SETUP_FILES = ['@mnaoumov/typescript-test-toolkit/vitest-setup'];

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
          environment: 'jsdom',
          exclude: [...WORKSPACE_TEST_EXCLUDE, '**/*.integration.test.ts', ...GLOBAL_STUB_TEST_FILES],
          include: ['src/**/*.test.ts'],
          name: 'unit-tests',
          pool: 'vmThreads',
          setupFiles: SETUP_FILES
        }
      },
      {
        test: {
          environment: 'jsdom',
          exclude: WORKSPACE_TEST_EXCLUDE,
          include: GLOBAL_STUB_TEST_FILES,
          name: 'unit-tests:global-stubs',
          setupFiles: SETUP_FILES
        }
      }
    ],
    reporters: WORKSPACE_VITEST_REPORTERS
  }
});
