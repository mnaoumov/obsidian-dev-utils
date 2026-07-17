/**
 * @file
 *
 * Builds the `demo-vault-helper` bootstrap plugin into `dist/demo-vault-helper/`.
 *
 * The bundle is a standalone CommonJS Obsidian plugin (it bundles the `obsidian-dev-utils`
 * bootstrap logic), shipped in the package so `archivePluginDemoVault` can inject it into a
 * plugin's demo vault at release time.
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
const PLUGIN_DIR = join(PROJECT_ROOT, 'demo-vault-helper');
const DIST_DIR = join(PROJECT_ROOT, 'dist/demo-vault-helper');

/**
 * Bundles the `demo-vault-helper` plugin into `dist/demo-vault-helper/main.js`
 * and copies `manifest.json` alongside it.
 */
export async function buildDemoVaultHelper(): Promise<void> {
  if (existsSync(DIST_DIR)) {
    await rm(DIST_DIR, { recursive: true });
  }
  await mkdir(DIST_DIR, { recursive: true });

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
    outfile: join(DIST_DIR, 'main.js'),
    platform: 'node',
    target: 'ES2022'
  });

  await cp(join(PLUGIN_DIR, 'manifest.json'), join(DIST_DIR, 'manifest.json'));
}
