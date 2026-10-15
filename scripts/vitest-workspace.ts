/**
 * @file
 *
 * The pieces every workspace package's `vitest.config.ts` shares.
 *
 * The shared reporters, excludes and coverage block come from `@mnaoumov/typescript-dev-toolkit`'s library config,
 * imported by its published name, which the `@mnaoumov/source` condition resolves to its SOURCE here, because a
 * vitest config is loaded before any package is built.
 *
 * The most important local piece is {@link workspaceSourcePlugin}: a package's tests import its sibling packages by
 * their published names (`@mnaoumov/typescript-lib/async`), and inside this repository those must resolve to the
 * sibling's TypeScript SOURCE rather than to a `dist/` that may be stale or not built yet. Everywhere else that is
 * the `@mnaoumov/source` export condition (`.npmrc`, `tsconfig.base.json`); vite has a condition list per
 * environment that a config can only replace wholesale, so the same mapping is done here by a resolver instead.
 */

import type { DefineLibraryVitestConfigParams } from '@mnaoumov/typescript-dev-toolkit/test-runners/vitest-config';
import type {
  Plugin,
  ViteUserConfig
} from 'vitest/config';

import {
  DEFAULT_VITEST_REPORTERS,
  DEFAULT_VITEST_TEST_EXCLUDE,
  defineLibraryVitestConfig
} from '@mnaoumov/typescript-dev-toolkit/test-runners/vitest-config';
import { existsSync } from 'node:fs';
import {
  dirname,
  join
} from 'node:path';

const PACKAGES_FOLDER = join(import.meta.dirname, '../packages');
const WORKSPACE_SPECIFIER_REG_EXP = /^@mnaoumov\/(?<packageName>[a-z-]+)(?:\/(?<subpath>.+))?$/;

/**
 * The reporters every workspace vitest config pins.
 */
export const WORKSPACE_VITEST_REPORTERS = [...DEFAULT_VITEST_REPORTERS];

/**
 * Folders vitest never collects tests from.
 */
export const WORKSPACE_TEST_EXCLUDE = [...DEFAULT_VITEST_TEST_EXCLUDE];

/**
 * Defines a workspace package's vitest configuration: the shared library config plus {@link workspaceSourcePlugin}.
 *
 * @param params - The package's projects and, optionally, its top-level `resolve` options.
 * @returns The vitest configuration.
 */
export function defineWorkspaceVitestConfig(params: Pick<DefineLibraryVitestConfigParams, 'projects' | 'resolve'>): ViteUserConfig {
  return defineLibraryVitestConfig({ ...params, plugins: [workspaceSourcePlugin()] });
}

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
