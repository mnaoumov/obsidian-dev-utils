/**
 * This test file exists solely to import modules that are excluded from coverage
 * via `v8 ignore` comments. Without importing them, v8 never loads the files and
 * the ignore comments are not processed, causing them to appear as 0% covered.
 */
import {
  describe,
  expect,
  it
} from 'vitest';

import * as changeExtensionPlugin from '../../src/script-utils/bundlers/esbuild/changeExtensionPlugin.ts';
import * as copyToObsidianPluginsFolderPlugin from '../../src/script-utils/bundlers/esbuild/copyToObsidianPluginsFolderPlugin.ts';
import * as customEsbuildOptionsPlugin from '../../src/script-utils/bundlers/esbuild/customEsbuildOptionsPlugin.ts';
import * as Dependency from '../../src/script-utils/bundlers/esbuild/dependency.ts';
import * as fixEsmPlugin from '../../src/script-utils/bundlers/esbuild/fixEsmPlugin.ts';
import * as fixSourceMapsPlugin from '../../src/script-utils/bundlers/esbuild/fixSourceMapsPlugin.ts';
import * as ObsidianPluginBuilder from '../../src/script-utils/bundlers/esbuild/obsidian-plugin-builder.ts';
import * as preprocessPlugin from '../../src/script-utils/bundlers/esbuild/preprocessPlugin.ts';
import * as renameCssPlugin from '../../src/script-utils/bundlers/esbuild/renameCssPlugin.ts';
import * as svelteWrapperPlugin from '../../src/script-utils/bundlers/esbuild/svelteWrapperPlugin.ts';
import * as eslintConfig from '../../src/script-utils/linters/eslint/eslint.config.ts';
import * as markdownlintCli2Config from '../../src/script-utils/linters/markdownlint/markdownlint-cli2-config.ts';
import * as NodeModules from '../../src/script-utils/node-modules.ts';
import * as StateFieldSpec from '../../src/codemirror/state-field-spec.ts';
import * as DebugController from '../../src/debug-controller.ts';
import * as CodeBlockMarkdownInformation from '../../src/obsidian/code-block-markdown-information.ts';
import * as ValueComponentWithChangeTracking from '../../src/obsidian/components/setting-components/value-component-with-change-tracking.ts';
import * as CustomTypeOptionsBase from '../../src/obsidian/i18n/custom-type-options-base.ts';
import * as DefaultTranslationsBase from '../../src/obsidian/i18n/default-translations-base.ts';
import * as PluginSettingsWrapper from '../../src/obsidian/plugin/plugin-settings-wrapper.ts';
import * as PluginTypesBase from '../../src/obsidian/plugin/plugin-types-base.ts';

describe('v8 ignore imports', () => {
  it('should load NodeModules so v8 processes its ignore comments', () => {
    expect(NodeModules.process).toBeDefined();
  });

  it('should load eslint.config so v8 processes its ignore comments', () => {
    expect(eslintConfig.obsidianDevUtilsConfigs).toBeDefined();
  });

  it('should load Dependency so v8 processes its ignore comments', () => {
    expect(Dependency).toBeDefined();
  });

  it('should load ObsidianPluginBuilder so v8 processes its ignore comments', () => {
    expect(ObsidianPluginBuilder).toBeDefined();
  });

  it('should load changeExtensionPlugin so v8 processes its ignore comments', () => {
    expect(changeExtensionPlugin.changeExtensionPlugin).toBeDefined();
  });

  it('should load copyToObsidianPluginsFolderPlugin so v8 processes its ignore comments', () => {
    expect(copyToObsidianPluginsFolderPlugin.copyToObsidianPluginsFolderPlugin).toBeDefined();
  });

  it('should load customEsbuildOptionsPlugin so v8 processes its ignore comments', () => {
    expect(customEsbuildOptionsPlugin.customEsbuildOptionsPlugin).toBeDefined();
  });

  it('should load fixEsmPlugin so v8 processes its ignore comments', () => {
    expect(fixEsmPlugin.fixEsmPlugin).toBeDefined();
  });

  it('should load fixSourceMapsPlugin so v8 processes its ignore comments', () => {
    expect(fixSourceMapsPlugin.fixSourceMapsPlugin).toBeDefined();
  });

  it('should load preprocessPlugin so v8 processes its ignore comments', () => {
    expect(preprocessPlugin.preprocessPlugin).toBeDefined();
  });

  it('should load renameCssPlugin so v8 processes its ignore comments', () => {
    expect(renameCssPlugin.renameCssPlugin).toBeDefined();
  });

  it('should load svelteWrapperPlugin so v8 processes its ignore comments', () => {
    expect(svelteWrapperPlugin.svelteWrapperPlugin).toBeDefined();
  });

  it('should load markdownlint-cli2-config so v8 processes its ignore comments', () => {
    expect(markdownlintCli2Config.obsidianDevUtilsConfig).toBeDefined();
  });

  it('should load DebugController so v8 processes its ignore comments', () => {
    expect(DebugController).toBeDefined();
  });

  it('should load StateFieldSpec so v8 processes its ignore comments', () => {
    expect(StateFieldSpec).toBeDefined();
  });

  it('should load PluginSettingsWrapper so v8 processes its ignore comments', () => {
    expect(PluginSettingsWrapper).toBeDefined();
  });

  it('should load PluginTypesBase so v8 processes its ignore comments', () => {
    expect(PluginTypesBase).toBeDefined();
  });

  it('should load CustomTypeOptionsBase so v8 processes its ignore comments', () => {
    expect(CustomTypeOptionsBase).toBeDefined();
  });

  it('should load DefaultTranslationsBase so v8 processes its ignore comments', () => {
    expect(DefaultTranslationsBase).toBeDefined();
  });

  it('should load ValueComponentWithChangeTracking so v8 processes its ignore comments', () => {
    expect(ValueComponentWithChangeTracking).toBeDefined();
  });

  it('should load CodeBlockMarkdownInformation so v8 processes its ignore comments', () => {
    expect(CodeBlockMarkdownInformation).toBeDefined();
  });
});
