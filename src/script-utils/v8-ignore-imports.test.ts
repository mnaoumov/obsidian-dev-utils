/**
 * This test file exists solely to import modules that are excluded from coverage
 * via `v8 ignore` comments. Without importing them, v8 never loads the files and
 * the ignore comments are not processed, causing them to appear as 0% covered.
 */
import {
  expect,
  it
} from 'vitest';

/* eslint-disable import-x/no-namespace -- Namespace import needed to force v8 to load type-only module for coverage. */
import * as StateFieldSpec from '../codemirror/state-field-spec.ts';
import * as DebugController from '../debug-controller.ts';
import * as AttachmentPath from '../obsidian/attachment-path.ts';
import * as Backlink from '../obsidian/backlink.ts';
import * as CodeBlockMarkdownInformation from '../obsidian/code-block-markdown-information.ts';
import * as AbstractFileCommandBase from '../obsidian/commands/abstract-file-command-base.ts';
import * as CommandBase from '../obsidian/commands/command-base.ts';
import * as EditorCommandBase from '../obsidian/commands/editor-command-base.ts';
import * as FileCommandBase from '../obsidian/commands/file-command-base.ts';
import * as FolderCommandBase from '../obsidian/commands/folder-command-base.ts';
import * as NonEditorCommandBase from '../obsidian/commands/non-editor-command-base.ts';
import * as ValueComponentWithChangeTracking from '../obsidian/components/setting-components/value-component-with-change-tracking.ts';
import * as GetDomEventsHandlersConstructor from '../obsidian/constructors/getDomEventsHandlersConstructor.ts';
import * as CustomTypeOptionsBase from '../obsidian/i18n/custom-type-options-base.ts';
import * as DefaultTranslationsBase from '../obsidian/i18n/default-translations-base.ts';
import * as Markdown from '../obsidian/markdown.ts';
import * as PluginBase from '../obsidian/plugin/plugin-base.ts';
import * as PluginSettingsTabBase from '../obsidian/plugin/plugin-settings-tab-base.ts';
import * as PluginTypesBase from '../obsidian/plugin/plugin-types-base.ts';
import * as AppContext from '../obsidian/react/app-context.ts';
import * as RenameDeleteHandler from '../obsidian/rename-delete-handler.ts';
import { changeExtensionPlugin } from './bundlers/esbuild-impl/change-extension-plugin.ts';
import { copyToObsidianPluginsFolderPlugin } from './bundlers/esbuild-impl/copy-to-obsidian-plugins-folder-plugin.ts';
import { customEsbuildOptionsPlugin } from './bundlers/esbuild-impl/custom-esbuild-options-plugin.ts';
import { getDependenciesToBundle } from './bundlers/esbuild-impl/dependency.ts';
import { fixEsmPlugin } from './bundlers/esbuild-impl/fix-esm-plugin.ts';
import { fixSourceMapsPlugin } from './bundlers/esbuild-impl/fix-source-maps-plugin.ts';
import { BuildMode } from './bundlers/esbuild-impl/obsidian-plugin-builder.ts';
import { preprocessPlugin } from './bundlers/esbuild-impl/preprocess-plugin.ts';
import { renameCssPlugin } from './bundlers/esbuild-impl/rename-css-plugin.ts';
import { svelteWrapperPlugin } from './bundlers/esbuild-impl/svelte-wrapper-plugin.ts';
import * as Esbuild from './bundlers/esbuild.ts';
import * as CommitlintConfig from './commitlint-config.ts';
import { defineEslintConfigs } from './linters/eslint-config.ts';
import { obsidianDevUtilsConfig } from './linters/markdownlint-cli2-config.ts';
import * as NanoStagedConfig from './nano-staged-config.ts';

/* eslint-enable import-x/no-namespace -- Namespace import needed to force v8 to load type-only module for coverage. */

it('should load all v8-ignored modules so coverage processes their ignore comments', () => {
  const modules = [
    AbstractFileCommandBase,
    AppContext,
    AttachmentPath,
    Backlink,
    BuildMode,
    CodeBlockMarkdownInformation,
    CommandBase,
    CommitlintConfig,
    CustomTypeOptionsBase,
    DebugController,
    DefaultTranslationsBase,
    EditorCommandBase,
    Esbuild,
    FileCommandBase,
    FolderCommandBase,
    GetDomEventsHandlersConstructor,
    Markdown,
    NanoStagedConfig,
    NonEditorCommandBase,
    PluginBase,
    PluginSettingsTabBase,
    PluginTypesBase,
    RenameDeleteHandler,
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

  for (const mod of modules) {
    expect(mod).toBeDefined();
  }
});
