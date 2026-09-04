import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  defineObsidianPluginVitestConfig,
  ObsidianPluginVitestConfigContext
} from './vitest-config.ts';

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
    expect(context.bigTimeoutInMilliseconds).toBe(30_000);
    expect(context.hookTimeoutMultiplier).toBe(4);
    expect(context.performanceTimeoutInMilliseconds).toBe(600_000);
  });

  it('should derive each hook timeout from the project budget', () => {
    const context = new ObsidianPluginVitestConfigContext();
    expect(context.noApp.hookTimeout).toBe(120_000);
    expect(context.desktop.hookTimeout).toBe(120_000);
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
        // Be covered.
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
    // Every project to every test file, which `toMatchObject` above could never catch.
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

  it('should append the custom projects after the standard ones', () => {
    const config = defineObsidianPluginVitestConfig({
      customProjects(context) {
        return [{
          test: {
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
        testTimeout: 30_000
      }
    });
  });
});
