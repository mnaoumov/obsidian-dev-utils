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
    inline: ['obsidian-typings']
  }
};

const SHARED_EXCLUDE = ['node_modules', 'dist'];

const SCRIPT_UTILS_TEST_FILES = 'src/script-utils/**/*.test.ts';
const INTEGRATION_TEST_FILES = 'src/**/*.integration.test.ts';
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
        resolve: SHARED_RESOLVE,
        test: {
          environment: 'node',
          exclude: [...SHARED_EXCLUDE, INTEGRATION_TEST_FILES],
          include: [SCRIPT_UTILS_TEST_FILES],
          name: 'unit-tests:script-utils',
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
          setupFiles: ['obsidian-test-mocks/setup', './src/test-helpers/setup.ts']
        }
      },
      {
        resolve: SHARED_RESOLVE,
        test: {
          environment: 'node',
          include: [INTEGRATION_TEST_FILES],
          name: 'integration-tests',
          server: SHARED_SERVER,
          setupFiles: [],
          testTimeout: BIG_TIMEOUT_IN_MILLISECONDS
        }
      }
    ]
  }
});
