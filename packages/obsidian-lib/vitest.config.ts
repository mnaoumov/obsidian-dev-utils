import { defineConfig } from 'vitest/config';

import {
  WORKSPACE_COVERAGE,
  WORKSPACE_TEST_EXCLUDE,
  WORKSPACE_VITEST_REPORTERS,
  workspaceSourcePlugin
} from '../../scripts/vitest-workspace.ts';

// The same budget `defineObsidianPluginVitestConfig` gives every plugin's Obsidian projects: it clears the
// transports' per-eval cap, so an over-long closure fails with the harness's own diagnosis. See AGENTS.md.
const INTEGRATION_TEST_TIMEOUT_IN_MILLISECONDS = 45_000;

const SHARED_RESOLVE = {
  alias: {
    obsidian: 'obsidian-test-mocks/obsidian'
  }
};

const SHARED_SERVER = {
  // eslint-disable-next-line unicorn/name-replacements -- `deps` is a Vitest config key.
  deps: {
    inline: ['@obsidian-typings']
  }
};

const INTEGRATION_TEST_FILES = 'src/**/*.integration.test.ts';
const OBSIDIAN_INTEGRATION_TEST_FILES = 'src/**/*.obsidian.integration.test.ts';
const DEMO_VAULT_HELPER_INTEGRATION_TEST_FILE = 'src/demo-vault-helper.obsidian.integration.test.ts';
const CONSUMER_LIB_INTEGRATION_TEST_FILE = 'src/integration-test-lib.obsidian.integration.test.ts';
const PLUGIN_API_INTEGRATION_TEST_FILE = 'src/plugin/plugin-api.obsidian.integration.test.ts';

// The only file here that `vi.stubGlobal`s a DOM global the VM pool cannot redefine. See AGENTS.md.
const GLOBAL_STUB_TEST_FILES = ['src/is-in-obsidian.test.ts'];

const UNIT_TEST_SETUP_FILES = [
  'obsidian-test-mocks/vitest-setup',
  '@mnaoumov/obsidian-dev-toolkit/vitest-setup'
];

const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;

// Each Obsidian project below owns a SEPARATE Obsidian instance; distinct ascending group orders run them one
// after another, so only one instance is ever busy. See AGENTS.md.
const OBSIDIAN_SHARED_INSTANCE_GROUP_ORDER = 2;
const OBSIDIAN_DEMO_VAULT_HELPER_GROUP_ORDER = 3;
const OBSIDIAN_CONSUMER_LIB_GROUP_ORDER = 4;
const OBSIDIAN_PLUGIN_API_GROUP_ORDER = 5;

export default defineConfig({
  plugins: [workspaceSourcePlugin()],
  resolve: SHARED_RESOLVE,
  test: {
    coverage: WORKSPACE_COVERAGE,
    exclude: WORKSPACE_TEST_EXCLUDE,
    globals: false,
    onConsoleLog: (): false => false,
    projects: [
      {
        resolve: SHARED_RESOLVE,
        test: {
          environment: 'jsdom',
          exclude: [...WORKSPACE_TEST_EXCLUDE, INTEGRATION_TEST_FILES, ...GLOBAL_STUB_TEST_FILES],
          include: ['src/**/*.test.ts'],
          name: 'unit-tests',
          pool: 'vmThreads',
          server: SHARED_SERVER,
          setupFiles: UNIT_TEST_SETUP_FILES
        }
      },
      {
        resolve: SHARED_RESOLVE,
        test: {
          environment: 'jsdom',
          exclude: WORKSPACE_TEST_EXCLUDE,
          include: GLOBAL_STUB_TEST_FILES,
          name: 'unit-tests:global-stubs',
          server: SHARED_SERVER,
          setupFiles: UNIT_TEST_SETUP_FILES
        }
      },
      {
        resolve: SHARED_RESOLVE,
        test: {
          environment: 'node',
          exclude: [...WORKSPACE_TEST_EXCLUDE, OBSIDIAN_INTEGRATION_TEST_FILES],
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
          // These share ONE Obsidian instance and mutate its global state, so they run serially in one worker.
          exclude: [
            ...WORKSPACE_TEST_EXCLUDE,
            DEMO_VAULT_HELPER_INTEGRATION_TEST_FILE,
            CONSUMER_LIB_INTEGRATION_TEST_FILE,
            PLUGIN_API_INTEGRATION_TEST_FILE
          ],
          fileParallelism: false,
          globalSetup: ['../../scripts/integration-test-obsidian-global-setup.ts'],
          include: [OBSIDIAN_INTEGRATION_TEST_FILES],
          maxWorkers: 1,
          name: 'obsidian-integration-tests',
          sequence: { groupOrder: OBSIDIAN_SHARED_INSTANCE_GROUP_ORDER },
          setupFiles: [
            'obsidian-integration-testing/vitest-setup',
            '../../scripts/integration-test-obsidian-setup.ts'
          ],
          testTimeout: INTEGRATION_TEST_TIMEOUT_IN_MILLISECONDS
        }
      },
      {
        test: {
          environment: 'node',
          // Its OWN Obsidian instance and vault, so the bootstrap does not pollute the shared one.
          fileParallelism: false,
          globalSetup: ['../../scripts/demo-vault-helper-global-setup.ts'],
          include: [DEMO_VAULT_HELPER_INTEGRATION_TEST_FILE],
          maxWorkers: 1,
          name: 'obsidian-integration-tests:demo-vault-helper',
          sequence: { groupOrder: OBSIDIAN_DEMO_VAULT_HELPER_GROUP_ORDER },
          setupFiles: ['obsidian-integration-testing/vitest-setup'],
          testTimeout: INTEGRATION_TEST_TIMEOUT_IN_MILLISECONDS
        }
      },
      {
        test: {
          environment: 'node',
          // Proves the CONSUMER wiring: a vault with NO plugin-under-test, the harness seeded as a consumer's
          // would be, and `setupFiles` naming the PUBLISHED setup endpoint on purpose.
          fileParallelism: false,
          globalSetup: ['../../scripts/integration-test-consumer-lib-global-setup.ts'],
          include: [CONSUMER_LIB_INTEGRATION_TEST_FILE],
          maxWorkers: 1,
          name: 'obsidian-integration-tests:consumer-lib',
          sequence: { groupOrder: OBSIDIAN_CONSUMER_LIB_GROUP_ORDER },
          setupFiles: [
            'obsidian-integration-testing/vitest-setup',
            '@mnaoumov/obsidian-dev-toolkit/integration-test-setup'
          ],
          testTimeout: INTEGRATION_TEST_TIMEOUT_IN_MILLISECONDS
        }
      },
      {
        test: {
          environment: 'node',
          // Two separately bundled plugins in one vault: two copies of the library share one renderer.
          fileParallelism: false,
          globalSetup: ['../../scripts/integration-test-plugin-api-global-setup.ts'],
          include: [PLUGIN_API_INTEGRATION_TEST_FILE],
          maxWorkers: 1,
          name: 'obsidian-integration-tests:plugin-api',
          sequence: { groupOrder: OBSIDIAN_PLUGIN_API_GROUP_ORDER },
          setupFiles: ['obsidian-integration-testing/vitest-setup'],
          testTimeout: INTEGRATION_TEST_TIMEOUT_IN_MILLISECONDS
        }
      }
    ],
    reporters: WORKSPACE_VITEST_REPORTERS
  }
});
