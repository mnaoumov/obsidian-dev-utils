import { defineConfig } from 'vitest/config';

const SHARED_RESOLVE = {
  alias: {
    obsidian: 'obsidian-test-mocks/obsidian'
  }
};

const SHARED_COVERAGE = {
  exclude: [
    'src/**/@types/**',
    'src/**/index.ts',
    'src/**/*.d.ts',
    'src/**/*.test.ts',
    'src/test-helpers/**'
  ],
  include: ['src/**/*.ts'],
  provider: 'v8' as const,
  reporter: ['text', 'lcov', 'html'],
  reportsDirectory: './coverage'
};

const SHARED_SERVER = {
  deps: {
    inline: ['@obsidian-typings']
  }
};

const SHARED_EXCLUDE = ['node_modules', 'dist'];

const SCRIPT_UTILS_TEST_FILES = 'src/script-utils/**/*.test.ts';
const ESLINT_TYPECHECK_TEST_FILES = 'src/script-utils/linters/eslint-rules/*.test.ts';
const INTEGRATION_TEST_FILES = 'src/**/*.integration.test.ts';
const OBSIDIAN_INTEGRATION_TEST_FILES = 'src/**/*.obsidian.integration.test.ts';
const DOCS_GENERATOR_TEST_FILES = 'scripts/docs-gen/**/*.test.ts';
const DOCS_SITE_TEST_FILES = 'docs/src/**/*.test.ts';
const BUILD_SCRIPT_HELPERS_TEST_FILES = 'scripts/helpers/**/*.test.ts';
const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;

export const config = defineConfig({
  resolve: SHARED_RESOLVE,
  test: {
    coverage: SHARED_COVERAGE,
    exclude: SHARED_EXCLUDE,
    globals: false,
    onConsoleLog: (): false => false,
    projects: [
      {
        test: {
          environment: 'node',
          exclude: [...SHARED_EXCLUDE],
          include: [DOCS_GENERATOR_TEST_FILES, DOCS_SITE_TEST_FILES],
          name: 'unit-tests:docs-generator',
          setupFiles: []
        }
      },
      {
        test: {
          environment: 'node',
          exclude: [...SHARED_EXCLUDE],
          include: [BUILD_SCRIPT_HELPERS_TEST_FILES],
          name: 'unit-tests:build-scripts',
          setupFiles: []
        }
      },
      {
        resolve: SHARED_RESOLVE,
        test: {
          environment: 'node',
          exclude: [...SHARED_EXCLUDE, INTEGRATION_TEST_FILES, ESLINT_TYPECHECK_TEST_FILES],
          include: [SCRIPT_UTILS_TEST_FILES],
          name: 'unit-tests:script-utils',
          server: SHARED_SERVER,
          setupFiles: []
        }
      },
      {
        resolve: SHARED_RESOLVE,
        test: {
          environment: 'node',
          exclude: [...SHARED_EXCLUDE],
          include: [ESLINT_TYPECHECK_TEST_FILES],
          isolate: false,
          maxWorkers: 1,
          name: 'unit-tests:eslint-typecheck',
          sequence: {
            groupOrder: 1
          },
          server: SHARED_SERVER,
          setupFiles: []
        }
      },
      {
        resolve: SHARED_RESOLVE,
        test: {
          environment: 'jsdom',
          exclude: [...SHARED_EXCLUDE, SCRIPT_UTILS_TEST_FILES, INTEGRATION_TEST_FILES],
          include: ['src/**/*.test.ts'],
          name: 'unit-tests:obsidian',
          server: SHARED_SERVER,
          setupFiles: [
            'obsidian-test-mocks/vitest-setup',
            'obsidian-test-mocks/obsidian-typings/vitest-setup',
            './src/vitest-setup.ts'
          ]
        }
      },
      {
        resolve: SHARED_RESOLVE,
        test: {
          environment: 'node',
          exclude: [...SHARED_EXCLUDE, OBSIDIAN_INTEGRATION_TEST_FILES],
          include: [INTEGRATION_TEST_FILES],
          name: 'integration-tests',
          server: SHARED_SERVER,
          setupFiles: [],
          testTimeout: BIG_TIMEOUT_IN_MILLISECONDS
        }
      },
      {
        test: {
          environment: 'node',
          // These integration tests share ONE Obsidian instance and mutate its global state.
          // Parallel files would stomp each other: focus and the active workspace are global.
          // So this project runs serially in a single worker.
          fileParallelism: false,
          globalSetup: ['./scripts/integration-test-obsidian-global-setup.ts'],
          include: [OBSIDIAN_INTEGRATION_TEST_FILES],
          maxWorkers: 1,
          name: 'obsidian-integration-tests',
          setupFiles: [
            'obsidian-integration-testing/vitest-setup',
            './scripts/integration-test-obsidian-setup.ts'
          ],
          testTimeout: BIG_TIMEOUT_IN_MILLISECONDS
        }
      }
    ]
  }
});
