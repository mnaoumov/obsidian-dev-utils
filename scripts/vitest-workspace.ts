/**
 * @file
 *
 * The pieces every workspace package's `vitest.config.ts` shares.
 *
 * The most important one is {@link workspaceSourcePlugin}: a package's tests import its sibling packages by their
 * published names (`@mnaoumov/typescript-lib/async`), and inside this repository those must resolve to the
 * sibling's TypeScript SOURCE rather than to a `dist/` that may be stale or not built yet. Everywhere else that is
 * the `@mnaoumov/source` export condition (`.npmrc`, `tsconfig.base.json`); vite has a condition list per
 * environment that a config can only replace wholesale, so the same mapping is done here by a resolver instead.
 */

import type { Plugin } from 'vitest/config';

import { existsSync } from 'node:fs';
import {
  dirname,
  join
} from 'node:path';

const PACKAGES_FOLDER = join(import.meta.dirname, '../packages');
const WORKSPACE_SPECIFIER_REG_EXP = /^@mnaoumov\/(?<packageName>[a-z-]+)(?:\/(?<subpath>.+))?$/;

/**
 * The reporters every workspace package's vitest config pins: the same pin `DEFAULT_VITEST_REPORTERS` gives every
 * consumer, restated rather than imported because a vitest config is loaded before any package is built.
 */
export const WORKSPACE_VITEST_REPORTERS = ['default'];

/**
 * Folders vitest never collects tests from.
 */
export const WORKSPACE_TEST_EXCLUDE = ['node_modules', 'dist'];

/**
 * The coverage options every workspace package shares. Each package gates on 100% of its own `src/`.
 */
export const WORKSPACE_COVERAGE = {
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
 * Resolves `@mnaoumov/<package>[/<subpath>]` onto that workspace package's TypeScript source.
 *
 * @returns The vite plugin.
 */
export function workspaceSourcePlugin(): Plugin {
  return {
    enforce: 'pre',
    name: 'workspace-source',
    resolveId(source: string): null | string {
      const match = WORKSPACE_SPECIFIER_REG_EXP.exec(source);
      const packageName = match?.groups?.['packageName'];
      if (!packageName) {
        return null;
      }

      const sourceFolder = join(PACKAGES_FOLDER, packageName, 'src');
      if (!existsSync(dirname(sourceFolder))) {
        return null;
      }

      const subpath = match.groups?.['subpath'];
      const candidates = subpath === undefined
        ? [join(sourceFolder, 'index.ts')]
        : [join(sourceFolder, `${subpath}.ts`), join(sourceFolder, subpath, 'index.ts')];
      return candidates.find((candidate) => existsSync(candidate)) ?? null;
    }
  };
}
