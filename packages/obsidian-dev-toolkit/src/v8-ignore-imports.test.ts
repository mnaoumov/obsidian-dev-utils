/* eslint-disable import-x/no-namespace -- Namespace import needed to force v8 to load type-only module for coverage. */
import * as AttachmentPath from '@mnaoumov/obsidian-lib/attachment-path';
import * as Backlink from '@mnaoumov/obsidian-lib/backlink';
import * as CodeBlockMarkdownInformation from '@mnaoumov/obsidian-lib/code-block-markdown-information';
import * as StateFieldSpec from '@mnaoumov/obsidian-lib/codemirror/state-field-spec';
import * as RenameDeleteHandlerComponent from '@mnaoumov/obsidian-lib/components/rename-delete-handler-component';
import * as GetDomEventsHandlersConstructor from '@mnaoumov/obsidian-lib/constructors/get-dom-events-handlers-constructor';
import * as CustomTypeOptionsBase from '@mnaoumov/obsidian-lib/i18n/custom-type-options';
import * as DefaultTranslationsBase from '@mnaoumov/obsidian-lib/i18n/default-translations';
import * as Markdown from '@mnaoumov/obsidian-lib/markdown';
import * as PluginBase from '@mnaoumov/obsidian-lib/plugin/plugin';
import * as PluginSettingsTabBase from '@mnaoumov/obsidian-lib/plugin/plugin-settings-tab';
import * as AppContext from '@mnaoumov/obsidian-lib/react/app-context';
import * as ValueComponentWithChangeTracking from '@mnaoumov/obsidian-lib/setting-components/value-component-with-change-tracking';
import { changeExtensionPlugin } from '@mnaoumov/typescript-dev-toolkit/bundlers/esbuild-impl/change-extension-plugin';
import { customEsbuildOptionsPlugin } from '@mnaoumov/typescript-dev-toolkit/bundlers/esbuild-impl/custom-esbuild-options-plugin';
import { fixEsmPlugin } from '@mnaoumov/typescript-dev-toolkit/bundlers/esbuild-impl/fix-esm-plugin';
import { svelteWrapperPlugin } from '@mnaoumov/typescript-dev-toolkit/bundlers/esbuild-impl/svelte-wrapper-plugin';
import * as CommitlintConfig from '@mnaoumov/typescript-dev-toolkit/commitlint-config';
import { obsidianDevUtilsConfig } from '@mnaoumov/typescript-dev-toolkit/linters/markdownlint-cli2-config';
import * as NanoStagedConfig from '@mnaoumov/typescript-dev-toolkit/nano-staged-config';
import * as DebugController from '@mnaoumov/typescript-lib/debug-controller';
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
    AppContext,
    AttachmentPath,
    Backlink,
    BuildMode,
    CodeBlockMarkdownInformation,
    CommitlintConfig,
    CustomTypeOptionsBase,
    DebugController,
    DefaultTranslationsBase,
    Esbuild,
    GetDomEventsHandlersConstructor,
    Markdown,
    NanoStagedConfig,
    PluginBase,
    PluginSettingsTabBase,
    RenameDeleteHandlerComponent,
    StateFieldSpec,
    ValueComponentWithChangeTracking,
    changeExtensionPlugin,
    copyToObsidianPluginsFolderPlugin,
    customEsbuildOptionsPlugin,
    fixEsmPlugin,
    fixSourceMapsPlugin,
    getDependenciesToBundle,
    obsidianDevUtilsConfig,
    defineEslintConfigs(),
    preprocessPlugin,
    renameCssPlugin,
    svelteWrapperPlugin
  ];

  for (const $module of modules) {
    expect($module).toBeDefined();
  }
});
