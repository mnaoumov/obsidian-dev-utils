/**
 * @file
 *
 * Builds the integration test harness plugin into `dist/dev/`
 * so that `obsidian-integration-testing`'s `coreSetup` can find it.
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
const DIST_DEV_DIR = join(PROJECT_ROOT, 'dist/dev');

/**
 * Bundles the integration test plugin into `dist/dev/main.js`
 * and copies `manifest.json` alongside it.
 */
export async function buildIntegrationTestPlugin(): Promise<void> {
  if (existsSync(DIST_DEV_DIR)) {
    await rm(DIST_DEV_DIR, { recursive: true });
  }
  await mkdir(DIST_DEV_DIR, { recursive: true });

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
    outfile: join(DIST_DEV_DIR, 'main.js'),
    platform: 'node',
    sourcemap: 'inline',
    target: 'ES2022'
  });

  await cp(join(PLUGIN_DIR, 'manifest.json'), join(DIST_DEV_DIR, 'manifest.json'));
}
