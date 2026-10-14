#!/usr/bin/env node

/**
 * @file
 *
 * Runs a TypeScript script with `jiti`, like the `jiti` CLI, but with every workspace package aliased onto its
 * SOURCE: `@mnaoumov/<package>/<subpath>` resolves to `packages/<package>/src/<subpath>`.
 *
 * `jiti` resolves a bare specifier through the `exports` map under its own fixed `node` + `import` / `require`
 * conditions, so the `@mnaoumov/source` condition `.npmrc` sets for Node is invisible to it: once a package has
 * been built, every script would load that package's `dist/` instead of its source, and run whatever was built last.
 * The alias closes that gap. It travels as `JITI_ALIAS`, which every `jiti` instance reads as its default, so the
 * processes a script spawns get it too — ESLint loading `eslint.config.mts` is one.
 *
 * Usage: `node scripts/run.mjs <script.ts> [...arguments]`.
 */

import { readdirSync } from 'node:fs';
import nodeModule from 'node:module';
import {
  join,
  resolve
} from 'node:path';
import process from 'node:process';

const PACKAGES_FOLDER = join(import.meta.dirname, '..', 'packages');

const alias = Object.fromEntries(
  readdirSync(PACKAGES_FOLDER, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => [`@mnaoumov/${dirent.name}`, join(PACKAGES_FOLDER, dirent.name, 'src')])
);
process.env['JITI_ALIAS'] = JSON.stringify(alias);

const script = process.argv.splice(2, 1)[0];

if (!script) {
  console.error('Usage: node scripts/run.mjs <script.ts> [...arguments]');
  process.exit(1);
}

if (nodeModule.enableCompileCache && !process.env['NODE_DISABLE_COMPILE_CACHE']) {
  try {
    nodeModule.enableCompileCache();
  } catch {
    // The compile cache is an optimization only.
  }
}

const { createJiti } = await import('jiti');

const jiti = createJiti(process.cwd(), { alias });

const resolved = (process.argv[1] = jiti.resolve(resolve(process.cwd(), script)));

await jiti.import(resolved).catch((error) => {
  console.error(error);
  process.exit(1);
});
