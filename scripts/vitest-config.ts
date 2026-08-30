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
  // eslint-disable-next-line unicorn/name-replacements -- `deps` is a Vitest config key.
  deps: {
    inline: ['@obsidian-typings']
  }
};

const SHARED_EXCLUDE = ['node_modules', 'dist'];

const SCRIPT_UTILS_TEST_FILES = 'src/script-utils/**/*.test.ts';
const ESLINT_TYPECHECK_TEST_FILES = 'src/script-utils/linters/eslint-rules/*.test.ts';
const INTEGRATION_TEST_FILES = 'src/**/*.integration.test.ts';
const OBSIDIAN_INTEGRATION_TEST_FILES = 'src/**/*.obsidian.integration.test.ts';
const DEMO_VAULT_HELPER_INTEGRATION_TEST_FILE = 'src/obsidian/demo-vault-helper.obsidian.integration.test.ts';
const CONSUMER_LIB_INTEGRATION_TEST_FILE = 'src/integration-test-lib.obsidian.integration.test.ts';
const PLUGIN_API_INTEGRATION_TEST_FILE = 'src/obsidian/plugin/plugin-api.obsidian.integration.test.ts';
const DOCS_GENERATOR_TEST_FILES = 'scripts/docs-gen/**/*.test.ts';
const DOCS_SITE_TEST_FILES = 'docs/src/**/*.test.ts';
const BUILD_SCRIPT_HELPERS_TEST_FILES = 'scripts/helpers/**/*.test.ts';
const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;

// Each Obsidian project below owns a SEPARATE Obsidian instance, and Vitest runs projects in PARALLEL.
// The per-project `fileParallelism: false` / `maxWorkers: 1` only serialize files WITHIN one project.
// Without a group order, three Electron apps therefore launch at once and compete for the machine.
// That contention stays invisible until one of them gets heavier, and then it fails the innocent ones.
// Adding one community-store install to the demo-vault-helper bootstrap starved the other two instances.
// Six `evalInObsidian` calls that pass standalone timed out at 30 s in the aggregate (2026-08-12, T451).
// Distinct group orders run these three one after another, ascending, so only one instance is ever busy.
// Every other project stays in the default group and keeps running in parallel, so nothing else is held up.
// Serializing them is also FASTER end to end here: the aggregate went from roughly four minutes to one.
// The numbering starts at 2 because `unit-tests:eslint-typecheck` already owns group 1.
// Sharing that group would run a full ts-morph typecheck beside an Obsidian instance, starving it again.
const ESLINT_TYPECHECK_GROUP_ORDER = 1;
const OBSIDIAN_SHARED_INSTANCE_GROUP_ORDER = 2;
const OBSIDIAN_DEMO_VAULT_HELPER_GROUP_ORDER = 3;
const OBSIDIAN_CONSUMER_LIB_GROUP_ORDER = 4;
const OBSIDIAN_PLUGIN_API_GROUP_ORDER = 5;

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
          setupFiles: [],
          // Rendering an OG image to a bitmap (satori + resvg) and building a ts-morph Project are genuinely slow.
          // Under the full aggregate they lose the CPU race and the default 5000 ms times them out.
          testTimeout: BIG_TIMEOUT_IN_MILLISECONDS
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
            groupOrder: ESLINT_TYPECHECK_GROUP_ORDER
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
          exclude: [
            ...SHARED_EXCLUDE,
            DEMO_VAULT_HELPER_INTEGRATION_TEST_FILE,
            CONSUMER_LIB_INTEGRATION_TEST_FILE,
            PLUGIN_API_INTEGRATION_TEST_FILE
          ],
          fileParallelism: false,
          globalSetup: ['./scripts/integration-test-obsidian-global-setup.ts'],
          include: [OBSIDIAN_INTEGRATION_TEST_FILES],
          maxWorkers: 1,
          name: 'obsidian-integration-tests',
          sequence: { groupOrder: OBSIDIAN_SHARED_INSTANCE_GROUP_ORDER },
          setupFiles: [
            'obsidian-integration-testing/vitest-setup',
            './scripts/integration-test-obsidian-setup.ts'
          ],
          testTimeout: BIG_TIMEOUT_IN_MILLISECONDS
        }
      },
      {
        test: {
          environment: 'node',
          // The demo-vault-helper bootstrap test runs in its OWN dedicated Obsidian instance/vault (isolated
          // From the shared instance above) via its own global setup, so it does not pollute the shared vault
          // The other `*.obsidian.integration.test.ts` files use. Serial single worker, same as above.
          fileParallelism: false,
          globalSetup: ['./scripts/demo-vault-helper-global-setup.ts'],
          include: [DEMO_VAULT_HELPER_INTEGRATION_TEST_FILE],
          maxWorkers: 1,
          name: 'obsidian-integration-tests:demo-vault-helper',
          sequence: { groupOrder: OBSIDIAN_DEMO_VAULT_HELPER_GROUP_ORDER },
          setupFiles: ['obsidian-integration-testing/vitest-setup'],
          testTimeout: BIG_TIMEOUT_IN_MILLISECONDS
        }
      },
      {
        test: {
          environment: 'node',
          // Proves the CONSUMER wiring, which no other project can: its own Obsidian instance/vault has NO
          // Plugin-under-test, and the harness plugin is seeded + enabled as a plain community plugin exactly
          // As a consumer's would be. `setupFiles` names the PUBLISHED setup endpoint on purpose.
          fileParallelism: false,
          globalSetup: ['./scripts/integration-test-consumer-lib-global-setup.ts'],
          include: [CONSUMER_LIB_INTEGRATION_TEST_FILE],
          maxWorkers: 1,
          name: 'obsidian-integration-tests:consumer-lib',
          sequence: { groupOrder: OBSIDIAN_CONSUMER_LIB_GROUP_ORDER },
          setupFiles: [
            'obsidian-integration-testing/vitest-setup',
            './src/integration-test-setup.ts'
          ],
          testTimeout: BIG_TIMEOUT_IN_MILLISECONDS
        }
      },
      {
        test: {
          environment: 'node',
          // Proves the cross-COPY claim, which no other project can reach: its own Obsidian instance/vault
          // Carries two separately bundled plugins, so two distinct copies of the library share one renderer.
          // That is the situation every real pair of plugins is in, and the only place where reading a
          // Registry record by class identity instead of structurally would actually fail.
          fileParallelism: false,
          globalSetup: ['./scripts/integration-test-plugin-api-global-setup.ts'],
          include: [PLUGIN_API_INTEGRATION_TEST_FILE],
          maxWorkers: 1,
          name: 'obsidian-integration-tests:plugin-api',
          sequence: { groupOrder: OBSIDIAN_PLUGIN_API_GROUP_ORDER },
          setupFiles: ['obsidian-integration-testing/vitest-setup'],
          testTimeout: BIG_TIMEOUT_IN_MILLISECONDS
        }
      }
    ]
  }
});
