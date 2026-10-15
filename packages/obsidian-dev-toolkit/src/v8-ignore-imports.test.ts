/* eslint-disable import-x/no-namespace -- Namespace import needed to force v8 to load type-only module for coverage. */
/**
 * This test file exists solely to import modules that are excluded from coverage
 * via `v8 ignore` comments. Without importing them, v8 never loads the files and
 * the ignore comments are not processed, causing them to appear as 0% covered.
 */
import {
  expect,
  it
} from 'vitest';

import { copyToObsidianPluginsFolderPlugin } from './bundlers/esbuild-impl/copy-to-obsidian-plugins-folder-plugin.ts';
import { getDependenciesToBundle } from './bundlers/esbuild-impl/dependency.ts';
import { fixSourceMapsPlugin } from './bundlers/esbuild-impl/fix-source-maps-plugin.ts';
import { BuildMode } from './bundlers/esbuild-impl/obsidian-plugin-builder.ts';
import { preprocessPlugin } from './bundlers/esbuild-impl/preprocess-plugin.ts';
import { renameCssPlugin } from './bundlers/esbuild-impl/rename-css-plugin.ts';
import * as Esbuild from './bundlers/esbuild.ts';
import { defineEslintConfigs } from './linters/eslint-config.ts';

/* eslint-enable import-x/no-namespace -- Namespace import needed to force v8 to load type-only module for coverage. */

it('should load all v8-ignored modules so coverage processes their ignore comments', () => {
  const modules = [
    BuildMode,
    Esbuild,
    copyToObsidianPluginsFolderPlugin,
    fixSourceMapsPlugin,
    getDependenciesToBundle,
    defineEslintConfigs(),
    preprocessPlugin,
    renameCssPlugin
  ];

  for (const $module of modules) {
    expect($module).toBeDefined();
  }
});
