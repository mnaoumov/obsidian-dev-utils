/**
 * @file
 * This module provides utilities for managing dependencies during the esbuild process.
 * It includes functions to determine which dependencies should be skipped and which
 * should be bundled, as well as an esbuild plugin for extracting dependencies to bundle.
 */

import {
  type BuildOptions,
  context,
  type Plugin
} from "esbuild";
import { readNpmPackage } from "../../Npm.ts";
import builtins from "builtin-modules";
import {
  banner,
  invoke
} from "./ObsidianPluginBuilder.ts";
import { preprocessPlugin } from "./preprocessPlugin.ts";
import { trimStart } from "../../String.ts";
import {
  getDirname,
  join
} from "../../Path.ts";
import { ObsidianDevUtilsRepoPaths } from "../ObsidianDevUtilsRepoPaths.ts";

/**
 * Retrieves the list of dependencies that should be skipped during the bundling process.
 *
 * @returns A `Promise` that resolves to a `Set` of dependency names to skip.
 */
export async function getDependenciesToSkip(): Promise<Set<string>> {
  const npmPackage = await readNpmPackage(getDirname(import.meta.url));
  const dependenciesToSkip = new Set<string>([...Object.keys(npmPackage.dependencies ?? {}), ...builtins]);
  for (const dependency of Object.keys(npmPackage.devDependencies ?? {})) {
    dependenciesToSkip.delete(dependency);
  }

  return dependenciesToSkip;
}

/**
 * Determines which dependencies should be bundled by esbuild.
 *
 * @returns A `Promise` that resolves to an array of dependency names to bundle.
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
    format: "cjs",
    logLevel: "info",
    outdir: "nothing-will-be-written-on-disk-so-this-does-not-matter",
    platform: "node",
    plugins: [
      preprocessPlugin(),
      extractDependenciesToBundlePlugin(dependenciesToSkip, dependenciesToBundle)
    ],
    sourcemap: "inline",
    target: "ESNext",
    treeShaking: true,
    write: false
  };

  const buildContext = await context(buildOptions);
  await invoke(buildContext, true);
  return Array.from(dependenciesToBundle).sort();
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
    name: "test",
    setup(build): void {
      build.onResolve({ filter: /^[^\.\/]/ }, (args) => {
        if (!args.importer.endsWith(".d.ts")) {
          const moduleName = trimStart(args.path.split("/")[0]!, "node:");
          if (!dependenciesToSkip.has(moduleName)) {
            dependenciesToBundle.add(args.path);
          }
        }
        return { path: args.path, external: true };
      });
    }
  };
}
