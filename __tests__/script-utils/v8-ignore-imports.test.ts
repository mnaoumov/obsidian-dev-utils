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

// eslint-disable-next-line import-x/no-namespace -- Namespace import needed to force v8 to load type-only module for coverage.
import * as StateFieldSpec from '../../src/codemirror/state-field-spec.ts';
// eslint-disable-next-line import-x/no-namespace -- Namespace import needed to force v8 to load type-only module for coverage.
import * as DebugController from '../../src/debug-controller.ts';
// eslint-disable-next-line import-x/no-namespace -- Namespace import needed to force v8 to load type-only module for coverage.
import * as CodeBlockMarkdownInformation from '../../src/obsidian/code-block-markdown-information.ts';
// eslint-disable-next-line import-x/no-namespace -- Namespace import needed to force v8 to load type-only module for coverage.
import * as ValueComponentWithChangeTracking from '../../src/obsidian/components/setting-components/value-component-with-change-tracking.ts';
// eslint-disable-next-line import-x/no-namespace -- Namespace import needed to force v8 to load type-only module for coverage.
import * as CustomTypeOptionsBase from '../../src/obsidian/i18n/custom-type-options-base.ts';
// eslint-disable-next-line import-x/no-namespace -- Namespace import needed to force v8 to load type-only module for coverage.
import * as DefaultTranslationsBase from '../../src/obsidian/i18n/default-translations-base.ts';
// eslint-disable-next-line import-x/no-namespace -- Namespace import needed to force v8 to load type-only module for coverage.
import * as PluginSettingsWrapper from '../../src/obsidian/plugin/plugin-settings-wrapper.ts';
// eslint-disable-next-line import-x/no-namespace -- Namespace import needed to force v8 to load type-only module for coverage.
import * as PluginTypesBase from '../../src/obsidian/plugin/plugin-types-base.ts';
import { changeExtensionPlugin } from '../../src/script-utils/bundlers/esbuild-impl/changeExtensionPlugin.ts';
import { copyToObsidianPluginsFolderPlugin } from '../../src/script-utils/bundlers/esbuild-impl/copyToObsidianPluginsFolderPlugin.ts';
import { customEsbuildOptionsPlugin } from '../../src/script-utils/bundlers/esbuild-impl/customEsbuildOptionsPlugin.ts';
import { getDependenciesToBundle } from '../../src/script-utils/bundlers/esbuild-impl/dependency.ts';
import { fixEsmPlugin } from '../../src/script-utils/bundlers/esbuild-impl/fixEsmPlugin.ts';
import { fixSourceMapsPlugin } from '../../src/script-utils/bundlers/esbuild-impl/fixSourceMapsPlugin.ts';
import { BuildMode } from '../../src/script-utils/bundlers/esbuild-impl/obsidian-plugin-builder.ts';
import { preprocessPlugin } from '../../src/script-utils/bundlers/esbuild-impl/preprocessPlugin.ts';
import { renameCssPlugin } from '../../src/script-utils/bundlers/esbuild-impl/renameCssPlugin.ts';
import { svelteWrapperPlugin } from '../../src/script-utils/bundlers/esbuild-impl/svelteWrapperPlugin.ts';
import { obsidianDevUtilsConfigs } from '../../src/script-utils/linters/eslint-config.ts';
import { obsidianDevUtilsConfig } from '../../src/script-utils/linters/markdownlint-cli2-config.ts';

describe('v8 ignore imports', () => {
  it('should load eslint.config so v8 processes its ignore comments', () => {
    expect(obsidianDevUtilsConfigs).toBeDefined();
  });

  it('should load Dependency so v8 processes its ignore comments', () => {
    expect(getDependenciesToBundle).toBeDefined();
  });

  it('should load ObsidianPluginBuilder so v8 processes its ignore comments', () => {
    expect(BuildMode).toBeDefined();
  });

  it('should load changeExtensionPlugin so v8 processes its ignore comments', () => {
    expect(changeExtensionPlugin).toBeDefined();
  });

  it('should load copyToObsidianPluginsFolderPlugin so v8 processes its ignore comments', () => {
    expect(copyToObsidianPluginsFolderPlugin).toBeDefined();
  });

  it('should load customEsbuildOptionsPlugin so v8 processes its ignore comments', () => {
    expect(customEsbuildOptionsPlugin).toBeDefined();
  });

  it('should load fixEsmPlugin so v8 processes its ignore comments', () => {
    expect(fixEsmPlugin).toBeDefined();
  });

  it('should load fixSourceMapsPlugin so v8 processes its ignore comments', () => {
    expect(fixSourceMapsPlugin).toBeDefined();
  });

  it('should load preprocessPlugin so v8 processes its ignore comments', () => {
    expect(preprocessPlugin).toBeDefined();
  });

  it('should load renameCssPlugin so v8 processes its ignore comments', () => {
    expect(renameCssPlugin).toBeDefined();
  });

  it('should load svelteWrapperPlugin so v8 processes its ignore comments', () => {
    expect(svelteWrapperPlugin).toBeDefined();
  });

  it('should load markdownlint-cli2-config so v8 processes its ignore comments', () => {
    expect(obsidianDevUtilsConfig).toBeDefined();
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
