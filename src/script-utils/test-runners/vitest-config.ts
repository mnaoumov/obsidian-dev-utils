/**
 * @file
 *
 * Shared vitest configuration for Obsidian plugins.
 *
 * Every plugin in the workspace declares the same five vitest projects — `unit-tests` plus the
 * `integration-tests:{no-app,desktop,desktop-performance,android}` family — with the same timeouts,
 * `setupFiles`, and `globalSetup` wiring. Maintaining that per repo means a convention change costs one
 * near-identical edit per plugin, and any repo that is missed drifts silently. This module owns that
 * configuration once, so a plugin's `scripts/vitest-config.ts` collapses to a single call.
 *
 * The seam mirrors {@link https://www.npmjs.com/package/obsidian-dev-utils | the ESLint one}
 * (`defineEslintConfigs`): the factory builds a context holding the standard projects, the caller edits
 * it in place through {@link DefineObsidianPluginVitestConfigOptions.editContext}, and appends any
 * project the base does not know about through
 * {@link DefineObsidianPluginVitestConfigOptions.customProjects}.
 */

import type {
  TestProjectConfiguration,
  TestProjectInlineConfiguration,
  ViteUserConfig
} from 'vitest/config';

import process from 'node:process';
import { defineConfig } from 'vitest/config';

/**
 * The `test` section of a single vitest project entry.
 */
export type ObsidianPluginVitestProjectConfig = NonNullable<TestProjectInlineConfiguration['test']>;

const ANDROID_TIMEOUT_IN_MILLISECONDS = 60_000;
const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;
const HOOK_TIMEOUT_MULTIPLIER = 4;
const PERFORMANCE_TIMEOUT_IN_MILLISECONDS = 600_000;

const ANDROID_TEST_FILES = 'src/**/*.android.integration.test.ts';
const CROSS_PLATFORM_TEST_FILES = 'src/**/*.cross-platform.integration.test.ts';
const DECLARATION_FILES = 'src/**/*.d.ts';
const DESKTOP_PERFORMANCE_TEST_FILES = 'src/**/*.desktop-performance.integration.test.ts';
const DESKTOP_TEST_FILES = 'src/**/*.desktop.integration.test.ts';
const INTEGRATION_TEST_FILES = 'src/**/*.integration.test.ts';
const NO_APP_TEST_FILES = 'src/**/*.no-app.integration.test.ts';
const UNIT_TEST_FILES = 'src/**/*.test.ts';

const OBSIDIAN_VERSION_ENV_VARIABLE_NAME = 'OBSIDIAN_VERSION';
const SHARED_EXCLUDE = ['node_modules', 'dist'];

/**
 * The options for defining a plugin's vitest configuration.
 */
export interface DefineObsidianPluginVitestConfigOptions {
  /**
   * A function that builds projects the base configuration does not know about, such as a plugin's own
   * `integration-tests:demo-vault` project. The returned projects are appended after the standard five.
   *
   * @param context - The vitest configuration context.
   * @returns The extra projects.
   */
  customProjects?(context: ObsidianPluginVitestConfigContext): TestProjectConfiguration[];

  /**
   * A function that edits the vitest configuration context before it is assembled into a configuration.
   *
   * @param context - The vitest configuration context.
   */
  editContext?(context: ObsidianPluginVitestConfigContext): void;
}

/**
 * The context for defining a plugin's vitest configuration.
 *
 * Every member is live: the arrays and objects it exposes are the very ones the assembled configuration
 * is built from, so editing them in place through
 * {@link DefineObsidianPluginVitestConfigOptions.editContext} is what customizes the result.
 */
export class ObsidianPluginVitestConfigContext {
  /**
   * The `integration-tests:android` project, running the mobile-only and cross-platform suites against an
   * Android emulator through Appium.
   */
  public readonly android: ObsidianPluginVitestProjectConfig = {
    environment: 'node',
    environmentOptions: {
      obsidianTransport: {
        appiumUrl: 'http://localhost:4723',
        avdName: 'obsidian_test',
        type: 'obsidian-android-appium'
      }
    },
    fileParallelism: false,
    globalSetup: ['obsidian-integration-testing/vitest-global-setup-plugin'],
    hookTimeout: ANDROID_TIMEOUT_IN_MILLISECONDS * HOOK_TIMEOUT_MULTIPLIER,
    include: [ANDROID_TEST_FILES, CROSS_PLATFORM_TEST_FILES],
    name: 'integration-tests:android',
    setupFiles: ['obsidian-integration-testing/vitest-setup'],
    testTimeout: ANDROID_TIMEOUT_IN_MILLISECONDS
  };

  /**
   * The per-test budget of the Android integration project, in milliseconds. Booting an emulator and
   * driving it over Appium is slower than the desktop path, hence its own constant.
   *
   * @default `60000`
   */
  public readonly androidTimeoutInMilliseconds = ANDROID_TIMEOUT_IN_MILLISECONDS;

  /**
   * The per-test budget of the regular integration projects, in milliseconds.
   *
   * @default `30000`
   */
  public readonly bigTimeoutInMilliseconds = BIG_TIMEOUT_IN_MILLISECONDS;

  /**
   * The coverage `exclude` globs. Push onto it to drop more files from the coverage report.
   *
   * Declaration files are excluded by default because the coverage `include` below is `src/**\/*.ts`,
   * which a `.d.ts` matches. A declaration file emits no runtime code, so it reports 0% and no test can
   * ever raise it — a plugin that grows one under `src/` silently loses its 100% gate, and the usual
   * remedy of an inline `v8 ignore` comment does not apply to a type-only file.
   */
  public readonly coverageExclude: string[] = [UNIT_TEST_FILES, DECLARATION_FILES];

  /**
   * The `integration-tests:desktop` project, running the desktop-only and cross-platform suites against a
   * real desktop Obsidian over CDP.
   */
  public readonly desktop: ObsidianPluginVitestProjectConfig = {
    environment: 'node',
    fileParallelism: false,
    globalSetup: ['obsidian-integration-testing/vitest-global-setup-plugin'],
    hookTimeout: BIG_TIMEOUT_IN_MILLISECONDS * HOOK_TIMEOUT_MULTIPLIER,
    include: [DESKTOP_TEST_FILES, CROSS_PLATFORM_TEST_FILES],
    name: 'integration-tests:desktop',
    setupFiles: ['obsidian-integration-testing/vitest-setup'],
    testTimeout: BIG_TIMEOUT_IN_MILLISECONDS
  };

  /**
   * The `integration-tests:desktop-performance` project, running the at-scale suites. It is declared for
   * every plugin even when there is no such suite yet — `passWithNoTests` makes an empty project free,
   * and the matching `test:integration:desktop:performance` script exists fleet-wide.
   */
  public readonly desktopPerformance: ObsidianPluginVitestProjectConfig = {
    environment: 'node',
    fileParallelism: false,
    globalSetup: ['obsidian-integration-testing/vitest-global-setup-plugin'],
    hookTimeout: PERFORMANCE_TIMEOUT_IN_MILLISECONDS,
    include: [DESKTOP_PERFORMANCE_TEST_FILES],
    name: 'integration-tests:desktop-performance',
    setupFiles: ['obsidian-integration-testing/vitest-setup'],
    testTimeout: PERFORMANCE_TIMEOUT_IN_MILLISECONDS
  };

  /**
   * The multiplier applied to a project's test budget to get its hook budget. A hook typically populates
   * and opens a vault, so it needs several times what a single test does.
   *
   * @default `4`
   */
  public readonly hookTimeoutMultiplier = HOOK_TIMEOUT_MULTIPLIER;

  /**
   * The `integration-tests:no-app` project, running the suites that need no Obsidian instance at all.
   */
  public readonly noApp: ObsidianPluginVitestProjectConfig = {
    environment: 'node',
    fileParallelism: false,
    hookTimeout: BIG_TIMEOUT_IN_MILLISECONDS * HOOK_TIMEOUT_MULTIPLIER,
    include: [NO_APP_TEST_FILES],
    name: 'integration-tests:no-app',
    testTimeout: BIG_TIMEOUT_IN_MILLISECONDS
  };

  /**
   * The per-test budget of the performance integration project, in milliseconds. A performance vault is
   * pre-populated with tens of thousands of notes before Obsidian opens, so both its setup and its tests
   * need far more time than the regular integration projects.
   *
   * @default `600000`
   */
  public readonly performanceTimeoutInMilliseconds = PERFORMANCE_TIMEOUT_IN_MILLISECONDS;

  /**
   * The `unit-tests` project, running the mocked-Obsidian suites in `jsdom`.
   */
  public readonly unitTests: ObsidianPluginVitestProjectConfig = {
    environment: 'jsdom',
    exclude: [...SHARED_EXCLUDE, INTEGRATION_TEST_FILES],
    execArgv: ['--no-webstorage'],
    include: [UNIT_TEST_FILES],
    name: 'unit-tests',
    server: {
      // eslint-disable-next-line unicorn/name-replacements -- `deps` is declared by `vitest`; renaming it here would not match the API.
      deps: {
        inline: ['@obsidian-typings', 'obsidian-dev-utils']
      }
    },
    setupFiles: [
      'obsidian-test-mocks/vitest-setup',
      'obsidian-dev-utils/vitest-setup'
    ]
  };

  /**
   * Creates a new context seeded with the standard projects.
   */
  public constructor() {
    const obsidianVersion = process.env[OBSIDIAN_VERSION_ENV_VARIABLE_NAME];

    /*
     * Support is the range [latest public, latest catalyst] and BOTH ends must work (G99), so the version
     * is a knob rather than a constant. The key is added ONLY when the variable is set: an explicit
     * `obsidianVersion` makes the harness resolve a concrete version and swap the asar, which is not what
     * an unpinned run does, so seeding a default here would change the behavior of every plugin.
     */
    if (obsidianVersion !== undefined) {
      this.desktop.environmentOptions = {
        obsidianTransport: {
          obsidianVersion,
          type: 'obsidian-cdp'
        }
      };
    }
  }
}

/**
 * Defines the vitest configuration for an Obsidian plugin.
 *
 * @param options - The options for defining the configuration.
 * @returns The vitest configuration.
 */
export function defineObsidianPluginVitestConfig(options: DefineObsidianPluginVitestConfigOptions = {}): ViteUserConfig {
  const context = new ObsidianPluginVitestConfigContext();

  if (options.editContext) {
    options.editContext(context);
  }

  const customProjects = options.customProjects?.(context) ?? [];

  return defineConfig({
    test: {
      coverage: {
        exclude: context.coverageExclude,
        include: ['src/**/*.ts'],
        provider: 'v8',
        reporter: ['text', 'lcov', 'html'],
        reportsDirectory: './coverage'
      },
      exclude: [...SHARED_EXCLUDE],
      globals: false,
      include: [UNIT_TEST_FILES],
      passWithNoTests: true,
      projects: [
        {
          resolve: {
            alias: {
              obsidian: 'obsidian-test-mocks/obsidian'
            }
          },
          test: context.unitTests
        },
        { test: context.noApp },
        { test: context.desktop },
        { test: context.desktopPerformance },
        { test: context.android },
        ...customProjects
      ]
    }
  });
}
