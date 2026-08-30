/**
 * @file
 *
 * Builds the two test-only plugins that prove the cross-plugin API registry works between SEPARATE copies of
 * `obsidian-dev-utils`.
 *
 * The separate esbuild runs are the point, not an implementation detail: two bundles mean two module
 * instances of `src/obsidian/plugin/plugin-api.ts` in one renderer, sharing nothing but the realm-global
 * registry bag — which is exactly the situation every real pair of plugins is in, since each bundles its own
 * copy of the library. A single bundle would prove nothing.
 *
 * The output is written under `dist/`, never shipped, and only read by
 * `scripts/integration-test-plugin-api-global-setup.ts`.
 */

import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import {
  cp,
  mkdir,
  rm
} from 'node:fs/promises';
import { join } from 'node:path';

import { ObsidianPluginRepoPaths } from '../../src/obsidian/plugin/obsidian-plugin-repo-paths.ts';
import { ObsidianDevUtilsRepoPaths } from '../../src/script-utils/obsidian-dev-utils-repo-paths.ts';

const PROJECT_ROOT = join(import.meta.dirname, '../..');

/**
 * One plugin to build: where its sources live, and where the bundle goes.
 */
interface PluginApiTestPluginBuildTarget {
  readonly outDirectory: string;
  readonly sourceDirectory: string;
}

const BUILD_TARGETS: readonly PluginApiTestPluginBuildTarget[] = [
  {
    outDirectory: ObsidianDevUtilsRepoPaths.DistPluginApiTestConsumer,
    sourceDirectory: ObsidianDevUtilsRepoPaths.IntegrationTestPluginApiConsumer
  },
  {
    outDirectory: ObsidianDevUtilsRepoPaths.DistPluginApiTestProvider,
    sourceDirectory: ObsidianDevUtilsRepoPaths.IntegrationTestPluginApiProvider
  }
];

/**
 * Bundles both plugins, each into its own folder alongside a copy of its `manifest.json`.
 */
export async function buildPluginApiTestPlugins(): Promise<void> {
  for (const target of BUILD_TARGETS) {
    await buildTarget(target);
  }
}

/**
 * Bundles one plugin.
 *
 * @param target - The plugin to build.
 */
async function buildTarget(target: PluginApiTestPluginBuildTarget): Promise<void> {
  const outDirectoryPath = join(PROJECT_ROOT, target.outDirectory);
  const sourceDirectoryPath = join(PROJECT_ROOT, target.sourceDirectory);

  if (existsSync(outDirectoryPath)) {
    await rm(outDirectoryPath, { recursive: true });
  }
  await mkdir(outDirectoryPath, { recursive: true });

  await build({
    bundle: true,
    entryPoints: [join(sourceDirectoryPath, ObsidianPluginRepoPaths.MainTs)],
    external: [
      'obsidian',
      'electron',
      '@codemirror/language',
      '@codemirror/state',
      '@codemirror/view',
      '@lezer/common'
    ],
    format: 'cjs',
    logLevel: 'info',
    outfile: join(outDirectoryPath, ObsidianPluginRepoPaths.MainJs),
    platform: 'node',
    sourcemap: 'inline',
    target: 'ES2022'
  });

  await cp(
    join(sourceDirectoryPath, ObsidianPluginRepoPaths.ManifestJson),
    join(outDirectoryPath, ObsidianPluginRepoPaths.ManifestJson)
  );
}
