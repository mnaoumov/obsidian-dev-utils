/**
 * @packageDocumentation ObsidianPluginBuilder
 * This module provides functionality to build and bundle an Obsidian plugin using esbuild.
 * It includes functions to handle the build process based on different build modes (development or production),
 * and it sets up various esbuild plugins to preprocess, lint, fix source maps, and copy files to the Obsidian plugins folder.
 */

import type {
  BuildContext,
  BuildOptions,
  Plugin
} from 'esbuild';

import { config } from 'dotenv';
import { context } from 'esbuild';

import { throwExpression } from '../../Error.ts';
import { ObsidianPluginRepoPaths } from '../../obsidian/Plugin/ObsidianPluginRepoPaths.ts';
import { join } from '../../Path.ts';
import { buildValidate } from '../build.ts';
import { CliTaskResult } from '../CliUtils.ts';
import {
  builtinModules,
  cp,
  existsSync,
  mkdir,
  process,
  rm,
  writeFile
} from '../NodeModules.ts';
import { readPackageJson } from '../Npm.ts';
import { resolvePathFromRoot } from '../Root.ts';
import { copyToObsidianPluginsFolderPlugin } from './copyToObsidianPluginsFolderPlugin.ts';
import { fixEsmPlugin } from './fixEsmPlugin.ts';
import { fixSourceMapsPlugin } from './fixSourceMapsPlugin.ts';
import { preprocessPlugin } from './preprocessPlugin.ts';

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
export interface BuildObsidianPluginOptions {
  /**
   * Custom esbuild plugins to be used during the build process.
   */
  customEsbuildPlugins?: Plugin[];

  /**
   * The build mode, either Development or Production
   */
  mode: BuildMode;

  /**
   * The directory for Obsidian configuration. Defaults to the `OBSIDIAN_CONFIG_DIR` environment variable.
   */
  obsidianConfigDir?: string;
}

interface ObsidianPluginBuilderEnv {
  OBSIDIAN_CONFIG_DIR: string;
}

/**
 * Builds the Obsidian plugin based on the specified mode and configuration directory.
 *
 * @param options - The parameters for building the plugin.
 * @returns A promise that resolves to a `TaskResult` indicating the success or failure of the build.
 */
export async function buildObsidianPlugin(options: BuildObsidianPluginOptions): Promise<CliTaskResult> {
  await buildValidate();
  config();
  const obsidianPluginBuilderEnv = process.env as Partial<ObsidianPluginBuilderEnv>;

  const {
    customEsbuildPlugins = [],
    mode,
    obsidianConfigDir: _obsidianConfigDir
  } = options;

  const obsidianConfigDir = _obsidianConfigDir ?? obsidianPluginBuilderEnv.OBSIDIAN_CONFIG_DIR ?? '';
  const isProductionBuild = mode === BuildMode.Production;

  const distDir = resolvePathFromRoot(isProductionBuild ? ObsidianPluginRepoPaths.DistBuild : ObsidianPluginRepoPaths.DistDev);
  if (!distDir) {
    throw new Error('Could not determine the dist directory');
  }

  if (existsSync(distDir)) {
    await rm(distDir, { recursive: true });
  }
  await mkdir(distDir, { recursive: true });

  const distFileNames = [
    ObsidianPluginRepoPaths.ManifestJson,
    ObsidianPluginRepoPaths.StylesCss
  ];
  if (!isProductionBuild) {
    await writeFile(join(distDir, ObsidianPluginRepoPaths.HotReload), '', 'utf-8');
  }

  for (const fileName of distFileNames) {
    const localFile = resolvePathFromRoot(fileName);
    if (!localFile) {
      throw new Error(`Could not determine the local file for ${fileName}`);
    }
    const distFile = join(distDir, fileName);

    if (existsSync(localFile)) {
      await cp(localFile, distFile);
    }
  }

  const distPath = join(distDir, ObsidianPluginRepoPaths.MainJs);

  const packageJson = await readPackageJson();
  const pluginName = packageJson.name ?? '(unknown)';

  const buildOptions: BuildOptions = {
    banner: {
      js: banner
    },
    bundle: true,
    entryPoints: [resolvePathFromRoot(join(ObsidianPluginRepoPaths.Src, ObsidianPluginRepoPaths.MainTs)) ?? throwExpression(new Error('Could not determine the entry point for the plugin'))],
    external: [
      'obsidian',
      'electron',
      '@codemirror/autocomplete',
      '@codemirror/collab',
      '@codemirror/commands',
      '@codemirror/language',
      '@codemirror/lint',
      '@codemirror/search',
      '@codemirror/state',
      '@codemirror/view',
      '@lezer/common',
      '@lezer/highlight',
      '@lezer/lr',
      'esbuild',
      'eslint',
      ...builtinModules
    ],
    format: 'cjs',
    logLevel: 'info',
    outfile: distPath,
    platform: 'node',
    plugins: [
      preprocessPlugin(),
      fixEsmPlugin(),
      fixSourceMapsPlugin(isProductionBuild, distPath, pluginName),
      ...customEsbuildPlugins,
      copyToObsidianPluginsFolderPlugin(isProductionBuild, distDir, obsidianConfigDir, pluginName)
    ],
    sourcemap: isProductionBuild ? false : 'inline',
    target: 'esnext',
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
export async function invokeEsbuild(buildContext: BuildContext, isProductionBuild: boolean): Promise<CliTaskResult> {
  if (isProductionBuild) {
    const result = await buildContext.rebuild();
    const isSuccess = result.errors.length == 0 && result.warnings.length == 0;
    return CliTaskResult.Success(isSuccess);
  } else {
    await buildContext.watch();
    return CliTaskResult.DoNotExit();
  }
}
