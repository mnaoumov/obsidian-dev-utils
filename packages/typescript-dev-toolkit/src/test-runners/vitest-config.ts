/**
 * @file
 *
 * Shared vitest configuration for TypeScript LIBRARY packages: the pinned reporters, the test excludes, the coverage
 * block, and {@link defineLibraryVitestConfig}, which wraps a package's own projects in them.
 *
 * The Obsidian plugin configuration (`@mnaoumov/obsidian-dev-toolkit/test-runners/vitest-config`) builds on the same
 * reporters and excludes, so the two cannot drift apart.
 */

import type {
  TestProjectConfiguration,
  ViteUserConfig
} from 'vitest/config';
import type { Reporter } from 'vitest/node';

/**
 * One entry of a vitest `reporters` list: the name of a built-in reporter (`'default'`, `'junit'`,
 * `'minimal'`, …) or a reporter instance.
 *
 * Spelled out rather than derived from vitest's own option type, whose parts (`ReporterName`,
 * `InlineReporter`) are internal to vitest and exported from none of its entry points. Naming the two
 * shapes directly keeps a reporters list a plain array a caller pushes onto, which the option type itself
 * cannot be, because it is a union of an array with a single value. Vitest's third accepted shape, a
 * `[name, options]` tuple, is deliberately left out: no repository on this toolchain uses one.
 */
export type VitestReporter = Reporter | string;

/**
 * The reporters every repo on this toolchain prints through.
 *
 * **Pinned, because vitest's fallback is not one reporter but two.** An unset `reporters` resolves to
 * `isAgent ? 'minimal' : 'default'`, and `std-env`'s `isAgent` is true inside every AI coding session —
 * it reads `AI_AGENT` plus a dozen tool-specific variables. `MinimalReporter` extends the default one
 * with `summary: false`, `silent: 'passed-only'`, and a `printTestModule` that returns early unless the
 * module FAILED. So the SAME `npm run test`, on the SAME tree, prints a line per test file for a
 * developer and not one for a session, and swallows a passing test's console output in the second case
 * only. Measured on the `unit-tests:script-utils` project of `obsidian-dev-utils` (43 files, vitest 5.0.1,
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
 */
export const DEFAULT_VITEST_REPORTERS: readonly VitestReporter[] = ['default'];

/**
 * Folders vitest never collects tests from.
 */
export const DEFAULT_VITEST_TEST_EXCLUDE: readonly string[] = ['node_modules', 'dist'];

/**
 * The coverage options of a library package: v8 over its own `src/`, without the generated barrels, the
 * declarations, the tests and the test helpers. The threshold is the `test:coverage` script's to set.
 */
export const LIBRARY_VITEST_COVERAGE = {
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

/**
 * Parameters for {@link defineLibraryVitestConfig}.
 */
export interface DefineLibraryVitestConfigParams {
  /**
   * The vite plugins, e.g. a resolver mapping sibling packages onto their source.
   */
  readonly plugins?: ViteUserConfig['plugins'];

  /**
   * The package's vitest projects.
   */
  readonly projects: TestProjectConfiguration[];

  /**
   * The top-level `resolve` options, applied to every project that does not set its own.
   */
  readonly resolve?: ViteUserConfig['resolve'];
}

/**
 * Defines a library package's vitest configuration: its own projects, wrapped in the shared reporters, excludes and
 * coverage block, with console output from passing tests suppressed.
 *
 * @param params - The configuration parameters.
 * @returns The vitest configuration.
 */
export function defineLibraryVitestConfig(params: DefineLibraryVitestConfigParams): ViteUserConfig {
  const config: ViteUserConfig = {
    plugins: params.plugins ?? [],
    test: {
      coverage: LIBRARY_VITEST_COVERAGE,
      exclude: [...DEFAULT_VITEST_TEST_EXCLUDE],
      globals: false,
      onConsoleLog: (): false => false,
      projects: params.projects,
      reporters: [...DEFAULT_VITEST_REPORTERS]
    }
  };

  if (params.resolve) {
    config.resolve = params.resolve;
  }

  return config;
}
