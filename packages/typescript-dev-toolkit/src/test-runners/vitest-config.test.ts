import {
  describe,
  expect,
  it
} from 'vitest';

import {
  DEFAULT_VITEST_REPORTERS,
  DEFAULT_VITEST_TEST_EXCLUDE,
  defineLibraryVitestConfig,
  LIBRARY_VITEST_COVERAGE
} from './vitest-config.ts';

describe('defineLibraryVitestConfig', () => {
  it('wraps the projects in the shared reporters, excludes and coverage block', () => {
    const projects = [{ test: { name: 'unit-tests' } }];

    const config = defineLibraryVitestConfig({ projects });

    expect(config.plugins).toEqual([]);
    expect(config.resolve).toBeUndefined();
    expect(config.test?.projects).toBe(projects);
    expect(config.test?.coverage).toBe(LIBRARY_VITEST_COVERAGE);
    expect(config.test?.exclude).toEqual(['node_modules', 'dist']);
    expect(config.test?.reporters).toEqual(['default']);
    expect(config.test?.globals).toBe(false);
    expect(config.test?.onConsoleLog?.('log', 'stdout', undefined)).toBe(false);
  });

  it('passes the plugins and the resolve options through', () => {
    const plugin = { name: 'fixture' };
    const resolve = { alias: { foo: 'bar' } };

    const config = defineLibraryVitestConfig({ plugins: [plugin], projects: [], resolve });

    expect(config.plugins).toEqual([plugin]);
    expect(config.resolve).toBe(resolve);
  });

  it('hands out copies, so a caller pushing onto one cannot change the shared pins', () => {
    const config = defineLibraryVitestConfig({ projects: [] });

    expect(config.test?.reporters).not.toBe(DEFAULT_VITEST_REPORTERS);
    expect(config.test?.exclude).not.toBe(DEFAULT_VITEST_TEST_EXCLUDE);
  });
});
