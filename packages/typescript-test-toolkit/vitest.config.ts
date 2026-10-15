import {
  defineWorkspaceVitestConfig,
  WORKSPACE_TEST_EXCLUDE
} from '../../scripts/vitest-workspace.ts';

// These two test process-level Node behavior (warnings, the Web globals a VM context lacks), so they run in a
// plain Node environment with no per-test setup, as they did beside the rest of the tooling.
const NODE_TEST_FILES = [
  'src/node-web-globals.test.ts',
  'src/warnings-as-errors.test.ts'
];

export default defineWorkspaceVitestConfig({
  projects: [
    {
      test: {
        environment: 'jsdom',
        exclude: [...WORKSPACE_TEST_EXCLUDE, ...NODE_TEST_FILES],
        include: ['src/**/*.test.ts'],
        name: 'unit-tests',
        pool: 'vmThreads',
        setupFiles: ['./src/vitest-setup.ts']
      }
    },
    {
      test: {
        environment: 'node',
        exclude: WORKSPACE_TEST_EXCLUDE,
        include: NODE_TEST_FILES,
        name: 'unit-tests:node',
        setupFiles: []
      }
    }
  ]
});
