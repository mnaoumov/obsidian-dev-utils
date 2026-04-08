/**
 * @file
 *
 * This module provides utilities for managing dependencies during the esbuild process.
 * It includes functions to determine which dependencies should be skipped and which
 * should be bundled, as well as an esbuild plugin for extracting dependencies to bundle.
 */

/* v8 ignore start -- esbuild plugin that resolves dependencies at build time; requires a live esbuild context. */

import type {
  BuildOptions,
  Plugin
} from 'esbuild';

import { context } from 'esbuild';
import {
  builtinModules,
  createRequire
} from 'node:module';

import {
  getFolderName,
  join
} from '../../../path.ts';
import { trimStart } from '../../../string.ts';
import { ensureNonNullable } from '../../../type-guards.ts';
import { readPackageJson } from '../../npm.ts';
import { ObsidianDevUtilsRepoPaths } from '../../obsidian-dev-utils-repo-paths.ts';
import {
  banner,
  invokeEsbuild
} from './obsidian-plugin-builder.ts';
import { preprocessPlugin } from './preprocess-plugin.ts';

const esmRequire = createRequire(import.meta.url);

interface ModuleWithDefaultExport {
  default: unknown;
}

/**
 * Determines which dependencies should be bundled by esbuild.
 *
 * @returns A {@link Promise} that resolves to an array of dependency names to bundle.
 */
export async function getDependenciesToBundle(): Promise<string[]> {
  const dependenciesToSkip = await getDependenciesToSkip();
  const dependenciesToBundle = new Set<string>();

  const buildOptions: BuildOptions = {
    banner: {
      js: banner
    },
    bundle: true,
    entryPoints: [join(ObsidianDevUtilsRepoPaths.Src, ObsidianDevUtilsRepoPaths.AnyPath, ObsidianDevUtilsRepoPaths.AnyTs)],
    format: 'cjs',
    logLevel: 'info',
    outdir: 'nothing-will-be-written-on-disk-so-this-does-not-matter',
    platform: 'node',
    plugins: [
      preprocessPlugin(),
      extractDependenciesToBundlePlugin(dependenciesToSkip, dependenciesToBundle)
    ],
    sourcemap: 'inline',
    target: 'ESNext',
    treeShaking: true,
    write: false
  };

  const buildContext = await context(buildOptions);
  await invokeEsbuild(buildContext, true);
  return Array.from(dependenciesToBundle).sort();
}

/**
 * Retrieves the list of dependencies that should be skipped during the bundling process.
 *
 * @returns A {@link Promise} that resolves to a {@link Set} of dependency names to skip.
 */
export async function getDependenciesToSkip(): Promise<Set<string>> {
  const packageJson = await readPackageJson(getFolderName(import.meta.url));
  const dependenciesToSkip = new Set<string>([...builtinModules, ...Object.keys(packageJson.dependencies ?? {}).filter(canSkipFromBundling)]);
  return dependenciesToSkip;
}

/**
 * Determines whether a module can be skipped from bundling.
 *
 * @param moduleName - The name of the module.
 * @returns A boolean indicating whether the module can be skipped from bundling.
 */
function canSkipFromBundling(moduleName: string): boolean {
  if (moduleName.startsWith('@types/')) {
    return true;
  }

  if (moduleName.startsWith('obsidian')) {
    return true;
  }

  if (moduleName === 'esbuild') {
    return true;
  }

  try {
    const module = esmRequire(moduleName) as ModuleWithDefaultExport;
    return !module.default;
  } catch {
    return false;
  }
}

/**
 * Creates an esbuild plugin that identifies which dependencies should be bundled.
 *
 * @param dependenciesToSkip - A set of dependency names that should be skipped during bundling.
 * @param dependenciesToBundle - A set where the names of dependencies to be bundled will be added.
 * @returns An esbuild `Plugin` object that extracts dependencies to bundle.
 */
function extractDependenciesToBundlePlugin(dependenciesToSkip: Set<string>, dependenciesToBundle: Set<string>): Plugin {
  return {
    name: 'test',
    setup(build): void {
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        if (!args.importer.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension)) {
          const moduleName = trimStart(ensureNonNullable(args.path.split('/')[0], 'Wrong path'), 'node:');
          if (!dependenciesToSkip.has(args.path) && !dependenciesToSkip.has(moduleName)) {
            dependenciesToBundle.add(args.path);
          }
        }
        return { external: true, path: args.path };
      });
    }
  };
}

/* v8 ignore stop */
