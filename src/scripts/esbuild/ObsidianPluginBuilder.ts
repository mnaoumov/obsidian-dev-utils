/**
 * @packageDocumentation ObsidianPluginBuilder
 * This module provides functionality to build and bundle an Obsidian plugin using esbuild.
 * It includes functions to handle the build process based on different build modes (development or production),
 * and it sets up various esbuild plugins to preprocess, lint, fix source maps, and copy files to the Obsidian plugins folder.
 */

import {
  context,
  type BuildContext,
  type BuildOptions,
  type Plugin
} from "esbuild";
import process from "node:process";
import { existsSync } from "node:fs";
import {
  cp,
  mkdir,
  rm,
  writeFile
} from "node:fs/promises";
import { resolvePathFromRoot } from "../Root.ts";
import { CliTaskResult } from "../CliUtils.ts";
import { readNpmPackage } from "../Npm.ts";
import { preprocessPlugin } from "./preprocessPlugin.ts";
import { lintPlugin } from "./lintPlugin.ts";
import { fixSourceMapsPlugin } from "./fixSourceMapsPlugin.ts";
import { copyToObsidianPluginsFolderPlugin } from "./copyToObsidianPluginsFolderPlugin.ts";
import { ObsidianPluginRepoPaths } from "../../obsidian/Plugin/ObsidianPluginRepoPaths.ts";
import { join } from "../../Path.ts";
import builtins from "builtin-modules";

/**
 * Enumeration representing the build modes.
 */
export enum BuildMode {
  /** Development mode for building the plugin */
  Development,
  /** Production mode for building the plugin */
  Production
}

/**
 * Banner text to be included at the top of the generated files.
 */
export const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;


/**
 * Options for building an Obsidian plugin.
 */
export type BuildObsidianPluginOptions = {
  /**
   * The build mode, either Development or Production
   */
  mode: BuildMode;

  /**
   * The directory for Obsidian configuration. Defaults to the OBSIDIAN_CONFIG_DIR environment variable.
   */
  obsidianConfigDir?: string;

  /**
   * Custom esbuild plugins to be used during the build process.
   */
  customEsbuildPlugins?: Plugin[]
};

/**
 * Builds the Obsidian plugin based on the specified mode and configuration directory.
 *
 * @param options - The parameters for building the plugin.
 * @returns A promise that resolves to a `TaskResult` indicating the success or failure of the build.
 */
export async function buildObsidianPlugin(options: BuildObsidianPluginOptions): Promise<CliTaskResult> {
  const {
    mode,
    obsidianConfigDir = process.env["OBSIDIAN_CONFIG_DIR"],
    customEsbuildPlugins = []
  } = options;
  const isProductionBuild = mode === BuildMode.Production;

  const distDir = resolvePathFromRoot(isProductionBuild ? ObsidianPluginRepoPaths.DistBuild : ObsidianPluginRepoPaths.DistDev);
  if (existsSync(distDir)) {
    await rm(distDir, { recursive: true });
  }
  await mkdir(distDir, { recursive: true });

  const distFileNames = [
    ObsidianPluginRepoPaths.ManifestJson,
    ObsidianPluginRepoPaths.StylesCss
  ];
  if (!isProductionBuild) {
    await writeFile(join(distDir, ObsidianPluginRepoPaths.HotReload), "", "utf-8");
  }

  for (const fileName of distFileNames) {
    const localFile = resolvePathFromRoot(fileName);
    const distFile = join(distDir, fileName);

    if (existsSync(localFile)) {
      await cp(localFile, distFile);
    }
  }

  const distPath = join(distDir, ObsidianPluginRepoPaths.MainJs);

  const npmPackage = await readNpmPackage();
  const pluginName = npmPackage.name;

  const buildOptions: BuildOptions = {
    banner: {
      js: banner,
    },
    bundle: true,
    entryPoints: [resolvePathFromRoot(join(ObsidianPluginRepoPaths.Src, ObsidianPluginRepoPaths.MainTs))],
    external: [
      "obsidian",
      "electron",
      "@codemirror/autocomplete",
      "@codemirror/collab",
      "@codemirror/commands",
      "@codemirror/language",
      "@codemirror/lint",
      "@codemirror/search",
      "@codemirror/state",
      "@codemirror/view",
      "@lezer/common",
      "@lezer/highlight",
      "@lezer/lr",
      "esbuild",
      "eslint",
      ...builtins
    ],
    format: "cjs",
    logLevel: "info",
    outfile: distPath,
    platform: "node",
    plugins: [
      preprocessPlugin(),
      lintPlugin(isProductionBuild),
      fixSourceMapsPlugin(isProductionBuild, distPath, pluginName),
      ...customEsbuildPlugins,
      copyToObsidianPluginsFolderPlugin(isProductionBuild, distDir, obsidianConfigDir, pluginName),
    ],
    sourcemap: isProductionBuild ? false : "inline",
    target: "esnext",
    treeShaking: true
  };

  const buildContext = await context(buildOptions);
  return await invokeEsbuild(buildContext, isProductionBuild);
}

/**
 * Invokes the build process with the provided build context.
 *
 * @param buildContext - The build context generated by esbuild.
 * @param isProductionBuild - A boolean indicating whether the build is a production build.
 * @returns A promise that resolves to a `TaskResult` indicating the success or failure of the build.
 */
export async function invokeEsbuild(buildContext: BuildContext<BuildOptions>, isProductionBuild: boolean): Promise<CliTaskResult> {
  if (isProductionBuild) {
    const result = await buildContext.rebuild();
    const isSuccess = result.errors.length == 0 && result.warnings.length == 0;
    return CliTaskResult.Success(isSuccess);
  } else {
    await buildContext.watch();
    return CliTaskResult.DoNotExit();
  }
}