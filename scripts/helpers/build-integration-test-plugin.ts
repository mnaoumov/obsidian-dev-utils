/**
 * @file
 *
 * Builds the integration test harness plugin — the plugin that exposes the whole library on
 * `window.__obsidianDevUtilsModule`, which is what makes every helper reachable as `lib.<helper>` inside
 * an `evalInObsidian` closure.
 *
 * Two callers, two output folders:
 *
 * - `npm run build:integration-test-plugin` builds it into `dist/integration-test-plugin/`, which SHIPS in
 *   the package so a consumer plugin can seed it into its own integration-test vault (see
 *   `src/script-utils/test-runners/integration-test-plugin.ts`).
 * - This repo's own Obsidian integration global setup builds it into `dist/dev/`, because that is where
 *   `obsidian-integration-testing` looks for the plugin-under-test.
 */

import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import {
  cp,
  mkdir,
  rm
} from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_ROOT = join(import.meta.dirname, '../..');
const PLUGIN_DIR = join(PROJECT_ROOT, 'integration-test-plugin');

/**
 * Parameters for {@link buildIntegrationTestPlugin}.
 */
export interface BuildIntegrationTestPluginParams {
  /**
   * Project-root-relative folder to write `main.js` and `manifest.json` into. Recreated from scratch on
   * every build.
   */
  readonly outDir: string;

  /**
   * Whether to embed an inline source map. On for this repo's own `dist/dev` build, where it makes an
   * integration-test failure readable; off for the shipped copy, which a consumer only ever seeds into a
   * temp vault (and has to sync to a device), so the extra megabytes buy nothing.
   *
   * @default true
   */
  readonly shouldGenerateSourceMap?: boolean;
}

/**
 * Bundles the integration test plugin into `<outDir>/main.js` and copies `manifest.json` alongside it.
 *
 * @param params - The parameters for building the plugin.
 */
export async function buildIntegrationTestPlugin(params: BuildIntegrationTestPluginParams): Promise<void> {
  const outDirPath = join(PROJECT_ROOT, params.outDir);

  if (existsSync(outDirPath)) {
    await rm(outDirPath, { recursive: true });
  }
  await mkdir(outDirPath, { recursive: true });

  await build({
    bundle: true,
    entryPoints: [join(PLUGIN_DIR, 'main.ts')],
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
    outfile: join(outDirPath, 'main.js'),
    platform: 'node',
    sourcemap: (params.shouldGenerateSourceMap ?? true) ? 'inline' : false,
    target: 'ES2022'
  });

  await cp(join(PLUGIN_DIR, 'manifest.json'), join(outDirPath, 'manifest.json'));
}
