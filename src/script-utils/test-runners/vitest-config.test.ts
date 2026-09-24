import type {
  TestProjectConfiguration,
  ViteUserConfig
} from 'vitest/config';

import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  basename,
  join
} from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';
import { createVitest } from 'vitest/node';

import {
  DEFAULT_VITEST_REPORTERS,
  defineObsidianPluginVitestConfig,
  INTEGRATION_TEST_TIMEOUT_IN_MILLISECONDS,
  ObsidianPluginVitestConfigContext
} from './vitest-config.ts';

/**
 * The per-eval cap both transports enforce, restated here so the assertion below reads as a comparison of
 * two independent numbers rather than as a restatement of one.
 */
const TRANSPORT_EVAL_CAP_IN_MILLISECONDS = 30_000;

const STANDARD_PROJECT_NAMES = [
  'unit-tests',
  'integration-tests:no-app',
  'integration-tests:desktop',
  'integration-tests:desktop-performance',
  'integration-tests:android'
];

describe('ObsidianPluginVitestConfigContext', () => {
  beforeEach(() => {
    vi.stubEnv('OBSIDIAN_VERSION', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should expose the documented timeout defaults', () => {
    const context = new ObsidianPluginVitestConfigContext();
    expect(context.androidTimeoutInMilliseconds).toBe(60_000);
    expect(context.bigTimeoutInMilliseconds).toBe(45_000);
    expect(context.hookTimeoutMultiplier).toBe(4);
    expect(context.performanceTimeoutInMilliseconds).toBe(600_000);
  });

  /*
   * A per-test budget EQUAL to the transports' per-eval cap makes the harness's `EvalCapExceededError`
   * unreachable: vitest's clock starts at the top of the test and the transport's only once the eval is
   * dispatched, so vitest always wins and reports its anonymous timeout instead. Every project that can
   * run an `evalInObsidian` therefore has to clear the cap, which is what this pins — the desktop budget
   * was exactly the cap until the release abort of 2026-09-13 showed what that costs.
   */
  it('should give every Obsidian-driving project more time than the transports per-eval cap', () => {
    const context = new ObsidianPluginVitestConfigContext();
    expect(context.desktop.testTimeout).toBeGreaterThan(TRANSPORT_EVAL_CAP_IN_MILLISECONDS);
    expect(context.android.testTimeout).toBeGreaterThan(TRANSPORT_EVAL_CAP_IN_MILLISECONDS);
    expect(context.desktopPerformance.testTimeout).toBeGreaterThan(TRANSPORT_EVAL_CAP_IN_MILLISECONDS);
    expect(INTEGRATION_TEST_TIMEOUT_IN_MILLISECONDS).toBeGreaterThan(TRANSPORT_EVAL_CAP_IN_MILLISECONDS);
  });

  it('should derive each hook timeout from the project budget', () => {
    const context = new ObsidianPluginVitestConfigContext();
    expect(context.noApp.hookTimeout).toBe(180_000);
    expect(context.desktop.hookTimeout).toBe(180_000);
    expect(context.android.hookTimeout).toBe(240_000);
    expect(context.desktopPerformance.hookTimeout).toBe(600_000);
  });

  it('should collect the cross-platform suites in both platform projects', () => {
    const context = new ObsidianPluginVitestConfigContext();
    expect(context.desktop.include).toEqual([
      'src/**/*.desktop.integration.test.ts',
      'src/**/*.cross-platform.integration.test.ts'
    ]);
    expect(context.android.include).toEqual([
      'src/**/*.android.integration.test.ts',
      'src/**/*.cross-platform.integration.test.ts'
    ]);
  });

  it('should keep every integration suite out of the unit project', () => {
    const context = new ObsidianPluginVitestConfigContext();
    expect(context.unitTests.exclude).toEqual([
      'node_modules',
      'dist',
      'src/**/*.integration.test.ts'
    ]);
  });

  it('should run the unit project on the VM pool with no global-stub files by default', () => {
    const context = new ObsidianPluginVitestConfigContext();
    expect(context.unitTests.pool).toBe('vmThreads');
    expect(context.unitTests.execArgv).toEqual(['--no-webstorage']);
    expect(context.globalStubTestFiles).toEqual([]);
  });

  /*
   * Backs the `@default` tag on `reporters`, and the pin's whole reason: vitest resolves an unset
   * `reporters` to `isAgent ? 'minimal' : 'default'`, so without this the SAME command prints a line
   * per test file for a developer and not one for an AI coding session, whose `AI_AGENT` variable makes
   * `isAgent` true. Measured on this repo, 2026-09-23: 46 per-file lines pinned, 0 unset.
   */
  it('should pin the default reporter rather than leave it to vitest', () => {
    const context = new ObsidianPluginVitestConfigContext();
    expect(context.reporters).toEqual(['default']);
    expect(DEFAULT_VITEST_REPORTERS).toEqual(['default']);
  });

  /*
   * The member is documented as one a caller PUSHES onto, so it has to be a copy: a shared array would
   * let one plugin’s `editContext` reach the exported constant and, through it, every other context
   * built in the same process — which is what this repo’s own test run does.
   */
  it('should give each context its own reporters array', () => {
    const context = new ObsidianPluginVitestConfigContext();
    context.reporters.push('junit');
    expect(new ObsidianPluginVitestConfigContext().reporters).toEqual(['default']);
    expect(DEFAULT_VITEST_REPORTERS).toEqual(['default']);
  });

  it('should not pin an Obsidian version when the environment variable is unset', () => {
    const context = new ObsidianPluginVitestConfigContext();
    expect(context.desktop.environmentOptions).toBeUndefined();
  });

  it('should pin the Obsidian version from the environment variable when it is set', () => {
    vi.stubEnv('OBSIDIAN_VERSION', 'catalyst-latest');
    const context = new ObsidianPluginVitestConfigContext();
    expect(context.desktop.environmentOptions).toEqual({
      obsidianTransport: {
        obsidianVersion: 'catalyst-latest',
        type: 'obsidian-cdp'
      }
    });
  });
});

describe('defineObsidianPluginVitestConfig', () => {
  beforeEach(() => {
    vi.stubEnv('OBSIDIAN_VERSION', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should declare the standard projects in order', () => {
    const config = defineObsidianPluginVitestConfig();
    expect(config.test?.projects).toMatchObject(STANDARD_PROJECT_NAMES.map((name) => ({ test: { name } })));
  });

  it('should emit the pinned reporters', () => {
    const config = defineObsidianPluginVitestConfig();
    expect(config.test?.reporters).toEqual(['default']);
  });

  it('should reflect a reporter added through the context', () => {
    const config = defineObsidianPluginVitestConfig({
      editContext(context) {
        context.reporters.push('junit');
      }
    });
    expect(config.test?.reporters).toEqual(['default', 'junit']);
  });

  it('should alias obsidian to the mocks in the unit project only', () => {
    const config = defineObsidianPluginVitestConfig();
    expect(config.test?.projects?.[0]).toMatchObject({
      resolve: {
        alias: {
          obsidian: 'obsidian-test-mocks/obsidian'
        }
      }
    });
    expect(config.test?.projects?.[1]).not.toHaveProperty('resolve');
  });

  it('should configure the shared top-level section', () => {
    const config = defineObsidianPluginVitestConfig();
    expect(config.test).toMatchObject({
      coverage: {
        // Declaration files are excluded by default: `include` below matches them, and they can never
        // be covered.
        exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
        include: ['src/**/*.ts'],
        provider: 'v8',
        reporter: ['text', 'lcov', 'html'],
        reportsDirectory: './coverage'
      },
      exclude: ['node_modules', 'dist'],
      globals: false,
      passWithNoTests: true
    });

    // The root section deliberately declares no `include`, and this asserts the absence.
    // Under vitest 5 a project's own glob no longer replaces a root one, so a root glob widens
    // every project to every test file, which `toMatchObject` above could never catch.
    expect(config.test).not.toHaveProperty('include');
  });

  it('should reflect a context edit in the assembled configuration', () => {
    const config = defineObsidianPluginVitestConfig({
      editContext(context) {
        context.desktopPerformance.globalSetup = ['./scripts/vitest-global-setup-performance.ts'];
        context.coverageExclude.push('src/**/*.generated.ts');
      }
    });
    expect(config.test?.projects?.[3]).toMatchObject({
      test: {
        globalSetup: ['./scripts/vitest-global-setup-performance.ts']
      }
    });
    expect(config.test?.coverage).toMatchObject({
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/**/*.generated.ts']
    });
  });

  it('should move the global-stub files to a sibling unit project on the default pool', () => {
    const config = defineObsidianPluginVitestConfig({
      customProjects(): TestProjectConfiguration[] {
        return [{ test: { include: ['src/**/*.demo-vault.integration.test.ts'], name: 'integration-tests:demo-vault' } }];
      },
      editContext(context) {
        context.globalStubTestFiles.push('src/stubs-window.test.ts');
      }
    });
    expect(config.test?.projects).toMatchObject(
      [...STANDARD_PROJECT_NAMES, 'unit-tests:global-stubs', 'integration-tests:demo-vault'].map((name) => ({ test: { name } }))
    );
    expect(config.test?.projects?.[0]).toMatchObject({
      test: {
        exclude: ['node_modules', 'dist', 'src/**/*.integration.test.ts', 'src/stubs-window.test.ts'],
        include: ['src/**/*.test.ts'],
        pool: 'vmThreads'
      }
    });
    expect(config.test?.projects?.[5]).toEqual({
      resolve: {
        alias: {
          obsidian: 'obsidian-test-mocks/obsidian'
        }
      },
      test: {
        environment: 'jsdom',
        exclude: ['node_modules', 'dist', 'src/**/*.integration.test.ts'],
        execArgv: ['--no-webstorage'],
        include: ['src/stubs-window.test.ts'],
        name: 'unit-tests:global-stubs',
        pool: 'forks',
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
      }
    });
  });

  it('should exclude the global-stub files from a unit project whose own exclude was removed', () => {
    const config = defineObsidianPluginVitestConfig({
      editContext(context) {
        delete context.unitTests.exclude;
        context.globalStubTestFiles.push('src/stubs-window.test.ts');
      }
    });
    expect(config.test?.projects?.[0]).toMatchObject({ test: { exclude: ['src/stubs-window.test.ts'] } });
  });

  it('should keep a whole suite on the default pool when the context says so', () => {
    const config = defineObsidianPluginVitestConfig({
      editContext(context) {
        context.unitTests.pool = 'forks';
      }
    });
    expect(config.test?.projects?.[0]).toMatchObject({ test: { name: 'unit-tests', pool: 'forks' } });
  });

  it('should append the custom projects after the standard ones', () => {
    const config = defineObsidianPluginVitestConfig({
      customProjects(context) {
        return [{
          test: {
            include: ['src/**/*.demo-vault.integration.test.ts'],
            name: 'integration-tests:demo-vault',
            testTimeout: context.bigTimeoutInMilliseconds
          }
        }];
      }
    });
    expect(config.test?.projects).toMatchObject(
      [...STANDARD_PROJECT_NAMES, 'integration-tests:demo-vault'].map((name) => ({ test: { name } }))
    );
    expect(config.test?.projects?.[5]).toMatchObject({
      test: {
        testTimeout: 45_000
      }
    });
  });

  it('should refuse a custom project that declares no include of its own', () => {
    expect(() =>
      defineObsidianPluginVitestConfig({
        customProjects(): TestProjectConfiguration[] {
          return [{ test: { environment: 'node', name: 'integration-tests:demo-vault' } }];
        }
      })
    ).toThrow(/integration-tests:demo-vault declares no `test\.include`/);
  });

  it('should refuse a custom project whose include is empty', () => {
    expect(() =>
      defineObsidianPluginVitestConfig({
        customProjects(): TestProjectConfiguration[] {
          return [{ test: { include: [], name: 'integration-tests:demo-vault' } }];
        }
      })
    ).toThrow(/integration-tests:demo-vault declares no `test\.include`/);
  });

  it('should name a custom project by the label of its object name', () => {
    expect(() =>
      defineObsidianPluginVitestConfig({
        customProjects(): TestProjectConfiguration[] {
          return [{ test: { name: { color: 'cyan', label: 'integration-tests:demo-vault' } } }];
        }
      })
    ).toThrow(/integration-tests:demo-vault declares no `test\.include`/);
  });

  it('should name an unnamed custom project by its index', () => {
    expect(() =>
      defineObsidianPluginVitestConfig({
        customProjects(): TestProjectConfiguration[] {
          return [{ test: { include: ['src/**/*.a.test.ts'], name: 'a' } }, { test: {} }];
        }
      })
    ).toThrow(/at index 1 declares no `test\.include`/);
  });

  it('should leave a project vitest resolves for itself alone', () => {
    expect(() =>
      defineObsidianPluginVitestConfig({
        customProjects(): TestProjectConfiguration[] {
          // A glob string and an awaited configuration are both resolved by vitest itself, long after
          // this function has returned, so neither can be checked here.
          return ['./packages/*/vitest.config.ts', Promise.resolve({ test: { name: 'awaited' } })];
        }
      })
    ).not.toThrow();
  });
});

/*
 * The behavior, rather than the shape of one key.
 *
 * `expect(config.test).not.toHaveProperty('include')` above asserts that the root section declares no
 * glob; it says nothing about what vitest then does with the configuration. So it is blind to every
 * other way a project can be widened — a future change to how a project inherits a root glob, an
 * `includeSource`, a custom project with no glob of its own — and a widened project is silent: it
 * passes, slowly, having run the unit suites against a CDP transport and rewritten the checked-in
 * screenshots on the way.
 *
 * These cases hand the assembled configuration to vitest and ask it what each project would collect.
 * `createVitest` resolves the projects and globs their files in-process — no Obsidian, no `globalSetup`,
 * no test run — in well under a tenth of a second per call. `config: false` is what stops vitest walking
 * up from the fixture root and finding this repo's own `vitest.config.ts`.
 */
describe('defineObsidianPluginVitestConfig project isolation', () => {
  /**
   * One empty file per suffix: every standard project's, plus the three custom projects every plugin in
   * the workspace declares. `plain.test.ts` is the unit suite, and is the file a widened integration
   * project would pick up and run in the wrong environment.
   */
  const FIXTURE_TEST_FILE_NAMES = [
    'a.android-capture.integration.test.ts',
    'a.android.integration.test.ts',
    'a.cross-platform.integration.test.ts',
    'a.demo-vault.integration.test.ts',
    'a.desktop-capture.integration.test.ts',
    'a.desktop-performance.integration.test.ts',
    'a.desktop.integration.test.ts',
    'a.no-app.integration.test.ts',
    'plain.test.ts'
  ];

  /**
   * What each project must collect, and — because this is asserted as a whole map rather than one
   * project at a time — everything each project must NOT collect.
   */
  const EXPECTED_FILE_NAMES_BY_PROJECT: Record<string, string[]> = {
    'capture-screenshots:android': ['a.android-capture.integration.test.ts'],
    'capture-screenshots:desktop': ['a.desktop-capture.integration.test.ts'],
    'integration-tests:android': ['a.android.integration.test.ts', 'a.cross-platform.integration.test.ts'],
    'integration-tests:demo-vault': ['a.demo-vault.integration.test.ts'],
    'integration-tests:desktop': ['a.cross-platform.integration.test.ts', 'a.desktop.integration.test.ts'],
    'integration-tests:desktop-performance': ['a.desktop-performance.integration.test.ts'],
    'integration-tests:no-app': ['a.no-app.integration.test.ts'],
    'unit-tests': ['plain.test.ts']
  };

  const CAPTURE_PROJECT_NAMES = new Set(['capture-screenshots:android', 'capture-screenshots:desktop']);

  let fixtureRoot = '';

  beforeAll(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), 'obsidian-dev-utils-vitest-config-'));
    mkdirSync(join(fixtureRoot, 'src'));

    for (const fileName of FIXTURE_TEST_FILE_NAMES) {
      writeFileSync(join(fixtureRoot, 'src', fileName), 'export {};\n');
    }
  });

  afterAll(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  beforeEach(() => {
    vi.stubEnv('OBSIDIAN_VERSION', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /**
   * A plugin's own shape: the five standard projects plus the three custom ones every plugin in the
   * workspace declares.
   *
   * @returns The assembled configuration.
   */
  function makePluginConfig(): ViteUserConfig {
    return defineObsidianPluginVitestConfig({
      customProjects(context: ObsidianPluginVitestConfigContext): TestProjectConfiguration[] {
        return [
          {
            test: {
              ...context.android,
              include: ['src/**/*.android-capture.integration.test.ts'],
              name: 'capture-screenshots:android'
            }
          },
          {
            test: {
              ...context.desktop,
              include: ['src/**/*.desktop-capture.integration.test.ts'],
              name: 'capture-screenshots:desktop'
            }
          },
          {
            test: {
              ...context.desktop,
              include: ['src/**/*.demo-vault.integration.test.ts'],
              name: 'integration-tests:demo-vault'
            }
          }
        ];
      }
    });
  }

  /**
   * Asks vitest what each project of a configuration would collect against the fixture.
   *
   * @param config - The configuration to resolve.
   * @param projectFilter - The `--project` filters to apply, or `undefined` to run every project.
   * @returns The collected file names, keyed by project name and sorted within each project.
   */
  async function collectFileNamesByProject(
    config: ViteUserConfig,
    projectFilter?: string[]
  ): Promise<Record<string, string[]>> {
    const vitest = await createVitest({
      config: false,
      reporters: [],
      root: fixtureRoot,
      watch: false,
      // Spread rather than assigned, because `exactOptionalPropertyTypes` makes an explicit
      // `project: undefined` a different thing from an absent `project`.
      ...projectFilter && { project: projectFilter }
    }, config);

    try {
      const specifications = await vitest.globTestSpecifications();
      const fileNamesByProject: Record<string, string[]> = {};

      for (const specification of specifications) {
        const fileNames = fileNamesByProject[specification.project.name] ?? [];
        fileNames.push(basename(specification.moduleId));
        fileNamesByProject[specification.project.name] = fileNames;
      }

      for (const fileNames of Object.values(fileNamesByProject)) {
        fileNames.sort();
      }

      return fileNamesByProject;
    } finally {
      await vitest.close();
    }
  }

  it('should give every project exactly its own files', async () => {
    expect(await collectFileNamesByProject(makePluginConfig())).toEqual(EXPECTED_FILE_NAMES_BY_PROJECT);
  });

  it.each(Object.keys(EXPECTED_FILE_NAMES_BY_PROJECT))(
    'should collect only its own files when the run is filtered to %s',
    async (projectName) => {
      expect(await collectFileNamesByProject(makePluginConfig(), [projectName])).toEqual({
        [projectName]: EXPECTED_FILE_NAMES_BY_PROJECT[projectName]
      });
    }
  );

  /*
   * A plugin's `test` and `test:coverage` scripts pass `projects: ['unit-tests']`, which the runner expands
   * to `--project=unit-tests --project=unit-tests:*`. The sibling is only safe if that filter reaches it:
   * a stub file that no scripted run collects is a test that silently never runs.
   */
  it('should hand a global-stub file to the sibling project, which the unit-tests filter selects', async () => {
    const stubFilePath = join(fixtureRoot, 'src', 'stubs-window.test.ts');
    writeFileSync(stubFilePath, 'export {};\n');

    try {
      const config = defineObsidianPluginVitestConfig({
        editContext(context) {
          context.globalStubTestFiles.push('src/stubs-window.test.ts');
        }
      });
      expect(await collectFileNamesByProject(config, ['unit-tests', 'unit-tests:*'])).toEqual({
        'unit-tests': ['plain.test.ts'],
        'unit-tests:global-stubs': ['stubs-window.test.ts']
      });
    } finally {
      rmSync(stubFilePath);
    }
  });

  it('should leave the checked-in screenshots untouched by every project but the capture ones', async () => {
    const fileNamesByProject = await collectFileNamesByProject(makePluginConfig());

    for (const [projectName, fileNames] of Object.entries(fileNamesByProject)) {
      if (CAPTURE_PROJECT_NAMES.has(projectName)) {
        continue;
      }

      // A `*-capture.` suite opens a window, photographs it and overwrites a checked-in PNG.
      // Collecting one anywhere else is how `npm test` comes to rewrite the screenshots.
      expect(fileNames.filter((fileName) => fileName.includes('-capture.'))).toEqual([]);
    }
  });

  /*
   * The negative control, without which the greens above mean nothing: restoring the root glob this
   * configuration deliberately omits must make them ALL fail. It is also the tripwire for the vitest
   * behavior the omission depends on — under vitest 4 a project's own `include` replaced the root one,
   * so a root glob was merely redundant, and this case would have passed with the isolation intact.
   */
  it('should widen every project to every file once a root include is restored', async () => {
    const widened = makePluginConfig();
    widened.test = { ...widened.test, include: ['src/**/*.test.ts'] };

    const fileNamesByProject = await collectFileNamesByProject(widened);
    const everyFileName = [...FIXTURE_TEST_FILE_NAMES].sort();

    expect(Object.keys(fileNamesByProject).sort()).toEqual(Object.keys(EXPECTED_FILE_NAMES_BY_PROJECT).sort());

    for (const projectName of Object.keys(EXPECTED_FILE_NAMES_BY_PROJECT)) {
      if (projectName === 'unit-tests') {
        // The unit project excludes `src/**\/*.integration.test.ts` outright, so it is the one project
        // a root glob cannot widen — which is exactly why the defect was invisible to `npm test`.
        continue;
      }

      expect(fileNamesByProject[projectName]).toEqual(everyFileName);
    }
  });
});
