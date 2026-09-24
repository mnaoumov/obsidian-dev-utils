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
import type { Reporter } from 'vitest/node';

import process from 'node:process';
import { DEFAULT_EVAL_CAP_IN_MILLISECONDS } from 'obsidian-integration-testing';
import { defineConfig } from 'vitest/config';

/**
 * The `test` section of a single vitest project entry.
 */
export type ObsidianPluginVitestProjectConfig = NonNullable<TestProjectInlineConfiguration['test']>;

/**
 * One entry of a vitest `reporters` list: the name of a built-in reporter (`'default'`, `'junit'`,
 * `'minimal'`, …) or a reporter instance.
 *
 * Spelled out rather than derived from vitest's own option type, whose parts (`ReporterName`,
 * `InlineReporter`) are internal to vitest and exported from none of its entry points. Naming the two
 * shapes directly keeps {@link ObsidianPluginVitestConfigContext.reporters} a plain array a caller
 * pushes onto — the way {@link ObsidianPluginVitestConfigContext.coverageExclude} already is — which
 * the option type itself cannot be, because it is a union of an array with a single value. Vitest's
 * third accepted shape, a `[name, options]` tuple, is deliberately left out: nothing in the fleet uses
 * one, and a caller who needs it can still pass the whole list through `editContext`.
 */
export type ObsidianPluginVitestReporter = Reporter | string;

/**
 * The reporters every repo on this toolchain prints through.
 *
 * **Pinned, because vitest's fallback is not one reporter but two.** An unset `reporters` resolves to
 * `isAgent ? 'minimal' : 'default'`, and `std-env`'s `isAgent` is true inside every AI coding session —
 * it reads `AI_AGENT` plus a dozen tool-specific variables. `MinimalReporter` extends the default one
 * with `summary: false`, `silent: 'passed-only'`, and a `printTestModule` that returns early unless the
 * module FAILED. So the SAME `npm run test`, on the SAME tree, prints a line per test file for a
 * developer and not one for a session, and swallows a passing test's console output in the second case
 * only. Measured on this library's own `unit-tests:script-utils` project (43 files, vitest 5.0.1,
 * 2026-09-23): 46 per-file lines over a 58-line log pinned, 0 over a 13-line log unset.
 *
 * A gate should not report differently depending on who runs it, and a `console.log` a developer adds
 * to find something should not vanish because a session ran the suite. The cost of the pin is the ~45
 * lines above.
 *
 * **What this deliberately does NOT carry is a reporter naming the file a dead pool worker took with it,
 * because vitest 5 already does that itself.** `emitUnexpectedExit` is `(code, signal) => …` there, building
 * its message from the exit code, the signal, the runner state and the files the worker held. Driven
 * against real runs on 2026-09-23 in all four shapes: a worker `SIGKILL`ed mid-file, one killed at
 * import before collection, the same under `minimal`, and the realistic one — the dying file among 42
 * others in a parallel run — which reported `42 passed (43)` AND named the file. Under vitest 4 none of
 * that existed and the reader was left subtracting over file names the log did not contain, which is
 * what a reconciling reporter was written for; on 5 it would be a module, a test file and a coverage
 * burden for every consumer, carrying a claim that is no longer true.
 *
 * Exported because a repo that assembles its vitest projects by hand instead of through
 * {@link defineObsidianPluginVitestConfig} — this library's own suite among them — needs the same pin,
 * and restating it there is how the two drift apart.
 */
export const DEFAULT_VITEST_REPORTERS: readonly ObsidianPluginVitestReporter[] = ['default'];

/*
 * How much a project's per-test budget clears `DEFAULT_EVAL_CAP_IN_MILLISECONDS` by — the per-eval cap
 * BOTH transports enforce, imported from `obsidian-integration-testing` rather than restated so the
 * budgets below and the cap they are sized against can never be two numbers. One `evalInObsidian` closure
 * gets that much and no more, measured from the moment the transport dispatches it; outrunning it raises
 * `EvalCapExceededError`, which names the cap, the transport that enforced it, and the `pollInObsidian`
 * remedy — the one message that turns "this timed out" into "this closure asked for more time than
 * exists".
 *
 * A test budget EQUAL to the cap makes the cap's own diagnosis unreachable: vitest starts its clock at
 * the top of the test and the transport starts its own only once the eval is dispatched, so vitest always
 * wins by the few milliseconds in between and reports its anonymous `Test timed out in 30000ms`. That is
 * not a hypothetical — it is how every over-cap desktop eval had surfaced here until this margin existed,
 * and one of them aborted an otherwise green release five minutes into the preflight with no indication
 * of which wait was to blame (measured 2026-09-15: 30044 ms burned against a 30000 ms budget).
 *
 * The margin has to cover everything a test does BEFORE the eval that hangs — earlier ones included —
 * so it is a healthy fraction of the cap rather than a couple of seconds.
 */
const TRANSPORT_EVAL_CAP_MARGIN_IN_MILLISECONDS = 15_000;

/*
 * Android was never affected, and that asymmetry is the evidence the desktop equality was an oversight
 * rather than a decision: its budget has always been double the Appium cap, so an over-cap mobile closure
 * has always been able to report itself.
 */
const ANDROID_TIMEOUT_IN_MILLISECONDS = 60_000;
const HOOK_TIMEOUT_MULTIPLIER = 4;
const PERFORMANCE_TIMEOUT_IN_MILLISECONDS = 600_000;

/**
 * The per-test budget of the regular integration projects, in milliseconds.
 *
 * Exported because a repo that assembles its vitest projects by hand instead of through
 * {@link defineObsidianPluginVitestConfig} still needs the same relationship to the per-eval cap, and
 * restating the number there is how the two drift apart.
 */
export const INTEGRATION_TEST_TIMEOUT_IN_MILLISECONDS = DEFAULT_EVAL_CAP_IN_MILLISECONDS + TRANSPORT_EVAL_CAP_MARGIN_IN_MILLISECONDS;

const ANDROID_TEST_FILES = 'src/**/*.android.integration.test.ts';
const CROSS_PLATFORM_TEST_FILES = 'src/**/*.cross-platform.integration.test.ts';
const DECLARATION_FILES = 'src/**/*.d.ts';
const DESKTOP_PERFORMANCE_TEST_FILES = 'src/**/*.desktop-performance.integration.test.ts';
const DESKTOP_TEST_FILES = 'src/**/*.desktop.integration.test.ts';
const INTEGRATION_TEST_FILES = 'src/**/*.integration.test.ts';
const NO_APP_TEST_FILES = 'src/**/*.no-app.integration.test.ts';
const UNIT_TEST_FILES = 'src/**/*.test.ts';
const UNIT_TEST_GLOBAL_STUBS_PROJECT_NAME = 'unit-tests:global-stubs';

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
  readonly customProjects?: (context: ObsidianPluginVitestConfigContext) => TestProjectConfiguration[];

  /**
   * A function that edits the vitest configuration context before it is assembled into a configuration.
   *
   * @param context - The vitest configuration context.
   */
  readonly editContext?: (context: ObsidianPluginVitestConfigContext) => void;
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
   * It deliberately CLEARS the transports' per-eval cap rather than matching it, so that a closure which
   * outruns the cap fails with the harness's `EvalCapExceededError` — naming the cap and the remedy —
   * instead of with vitest's anonymous timeout. Lowering it to the cap restores that blind spot.
   *
   * @default `45000`
   */
  public readonly bigTimeoutInMilliseconds = INTEGRATION_TEST_TIMEOUT_IN_MILLISECONDS;

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
    hookTimeout: INTEGRATION_TEST_TIMEOUT_IN_MILLISECONDS * HOOK_TIMEOUT_MULTIPLIER,
    include: [DESKTOP_TEST_FILES, CROSS_PLATFORM_TEST_FILES],
    name: 'integration-tests:desktop',
    setupFiles: ['obsidian-integration-testing/vitest-setup'],
    testTimeout: INTEGRATION_TEST_TIMEOUT_IN_MILLISECONDS
  };

  /**
   * The `integration-tests:desktop-performance` project, running the at-scale suites. It is declared for
   * every plugin even when there is no such suite yet — `passWithNoTests` makes an empty project free,
   * and the matching `test:integration:desktop:performance` script exists in every plugin built on this library.
   *
   * A plugin's `test:integration` aggregate leaves this project out on purpose, and it stays out even on a
   * machine with a desktop Obsidian set up. The reason is the fixture rather than the cost: a perf suite
   * needs its own generated, populated vault, sized through env vars, and the aggregate's small temporary
   * vault is the wrong one. The 600 s below is a timeout, not a duration — measured end to end, most perf
   * suites finish in seconds, and only one that generates tens of thousands of notes takes minutes.
   *
   * No routine command runs them, but something does: a weekly sweep runs every plugin's
   * `test:integration:desktop:performance`, which is also how to reach them by hand. Adding them to that
   * aggregate is drift, not a gap to close.
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
   * The unit test files that redefine `window`, `document`, `location` or `top`, which the `unit-tests`
   * project's VM pool cannot run.
   *
   * Under `pool: 'vmThreads'` those four are non-configurable properties of the VM global, so
   * `vi.stubGlobal('window', …)` or `Object.defineProperty(window, 'location', …)` throws
   * `Cannot redefine property`. That is JS semantics, not a bug to route around. Every other global stays
   * configurable and stubs normally.
   *
   * Push a file here and it leaves `unit-tests` for a sibling `unit-tests:global-stubs` project that is
   * identical except for the pool, which is the default one. A plugin's `test` and `test:coverage` scripts
   * name `unit-tests`, which also selects every `unit-tests:*` project, so the sibling runs and is covered
   * without a script change. It is emitted only when this list is non-empty.
   *
   * To keep a whole suite on the default pool instead, set `unitTests.pool` to `'forks'` and say why.
   */
  public readonly globalStubTestFiles: string[] = [];

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
    hookTimeout: INTEGRATION_TEST_TIMEOUT_IN_MILLISECONDS * HOOK_TIMEOUT_MULTIPLIER,
    include: [NO_APP_TEST_FILES],
    name: 'integration-tests:no-app',
    testTimeout: INTEGRATION_TEST_TIMEOUT_IN_MILLISECONDS
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
   * The reporters the run prints through.
   *
   * Pinned rather than left to vitest, which resolves an unset `reporters` differently for a developer
   * and for an AI coding session — see {@link DEFAULT_VITEST_REPORTERS} for the whole of why, and for
   * what it deliberately leaves to vitest 5 itself.
   *
   * Push onto it to add a reporter beside the pinned one.
   *
   * @default {@link DEFAULT_VITEST_REPORTERS}
   */
  public readonly reporters: ObsidianPluginVitestReporter[] = [...DEFAULT_VITEST_REPORTERS];

  /**
   * The `unit-tests` project, running the mocked-Obsidian suites in `jsdom`.
   */
  public readonly unitTests: ObsidianPluginVitestProjectConfig = {
    environment: 'jsdom',
    exclude: [...SHARED_EXCLUDE, INTEGRATION_TEST_FILES],
    // A threads/forks pool option that still reaches the worker under the VM pool below: measured
    // 2026-09-16, `process.execArgv` carries it and Node's own `localStorage` descriptor is gone, as it
    // is under `threads`. Without the flag the descriptor is back under both pools.
    execArgv: ['--no-webstorage'],
    include: [UNIT_TEST_FILES],
    name: 'unit-tests',
    /*
     * The default pool constructs one jsdom per test file, and that construction, not the tests, was
     * the unit suite's cost: 67% of tracked time in `obsidian-dev-utils`' own suite. A VM pool builds
     * the jsdom once per worker and gives each file a fresh VM context, so per-file isolation holds.
     * Measured there on 2026-09-15: the jsdom project 36.06s -> 9.92s, `coverage/lcov.info`
     * byte-identical to the default pool's, and no DOM, `globalThis` or prototype state crossing files.
     * `isolate: false`, the other remedy vitest suggests, was slower (91.62s) and broke 68 tests.
     * The one cost is redefining `window`, `document`, `location` or `top`: see `globalStubTestFiles`.
     */
    pool: 'vmThreads',
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
     * Support is the range [latest public, latest catalyst] and BOTH ends must work, so the version
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
  validateCustomProjects(customProjects);

  const unitTestsResolve = {
    alias: {
      obsidian: 'obsidian-test-mocks/obsidian'
    }
  };
  const globalStubTestFiles = [...context.globalStubTestFiles];
  const unitTests: ObsidianPluginVitestProjectConfig = globalStubTestFiles.length === 0
    ? context.unitTests
    : { ...context.unitTests, exclude: [...context.unitTests.exclude ?? [], ...globalStubTestFiles] };
  const globalStubsProjects: TestProjectConfiguration[] = globalStubTestFiles.length === 0
    ? []
    : [{
      resolve: unitTestsResolve,
      test: {
        ...context.unitTests,
        include: globalStubTestFiles,
        name: UNIT_TEST_GLOBAL_STUBS_PROJECT_NAME,
        // The default pool, named rather than omitted so the spread above cannot carry the VM pool over.
        pool: 'forks'
      }
    }];

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
      /*
       * There is deliberately NO root-level `include` here, and restoring one breaks every project.
       * Under vitest 4 a project's own `include` replaced the root one, so a root
       * `include: [UNIT_TEST_FILES]` was merely redundant — the `unit-tests` project already declares
       * that same glob for itself. Under vitest 5 the project glob no longer replaces it, and
       * `src/**\/*.test.ts` is a superset of every project glob, so EVERY project collected EVERY test
       * file: unit suites ran in the CDP integration environment and died on `Failed to resolve entry
       * for package "obsidian"`, the screenshot-capture suites ran and rewrote checked-in PNGs, and the
       * android / demo-vault suites ran under the desktop transport. Measured in a consumer: the desktop
       * project collected 227 files instead of its own 105, and deleting this one line restored 105.
       */
      passWithNoTests: true,
      projects: [
        {
          resolve: unitTestsResolve,
          test: unitTests
        },
        { test: context.noApp },
        { test: context.desktop },
        { test: context.desktopPerformance },
        { test: context.android },
        ...globalStubsProjects,
        ...customProjects
      ],
      reporters: [...context.reporters]
    }
  });
}

/**
 * Refuses a custom project that declares no `include` glob of its own.
 *
 * The root section deliberately declares no `include` (see the comment on it above), so a project that
 * declares none falls back to vitest's own default glob — which matches EVERY test file in the repo.
 * That project then runs the unit suites in an Obsidian environment, the android suites under the
 * desktop transport, and the `*-capture.` screenshot suites that open a window and rewrite checked-in
 * PNGs. A widened project is silent: it passes, slowly, having done all of that.
 *
 * Only a plain inline configuration can be checked here. A project named by a glob string, built by a
 * function, or awaited from a promise is resolved by vitest itself, out of this function's reach.
 *
 * @param customProjects - The projects returned by {@link DefineObsidianPluginVitestConfigOptions.customProjects}.
 */
function validateCustomProjects(customProjects: TestProjectConfiguration[]): void {
  for (const [index, customProject] of customProjects.entries()) {
    if (typeof customProject !== 'object' || 'then' in customProject) {
      continue;
    }

    const include = customProject.test?.include;

    if (include && include.length > 0) {
      continue;
    }

    const name = customProject.test?.name;
    const label = typeof name === 'string' ? name : name?.label ?? `at index ${String(index)}`;

    throw new Error(
      `The custom vitest project ${label} declares no \`test.include\`, so vitest falls back to its default glob and the project collects EVERY test file — including the \`*-capture.\` suites that rewrite checked-in screenshots. Declare an explicit \`include\`, or spread a standard project (\`...context.desktop\`) and override it.`
    );
  }
}
