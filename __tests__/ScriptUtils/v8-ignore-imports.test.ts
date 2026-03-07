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

const HEAVY_IMPORT_TIMEOUT = 60_000;

describe('v8 ignore imports', () => {
  it('should load NodeModules so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/ScriptUtils/NodeModules.ts');
    expect(mod.process).toBeDefined();
  });

  it('should load eslint.config so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/ScriptUtils/linters/eslint/eslint.config.ts');
    expect(mod.obsidianDevUtilsConfigs).toBeDefined();
  }, HEAVY_IMPORT_TIMEOUT);

  it('should load Dependency so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/ScriptUtils/bundlers/esbuild/Dependency.ts');
    expect(mod).toBeDefined();
  });

  it('should load ObsidianPluginBuilder so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/ScriptUtils/bundlers/esbuild/ObsidianPluginBuilder.ts');
    expect(mod).toBeDefined();
  });

  it('should load changeExtensionPlugin so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/ScriptUtils/bundlers/esbuild/changeExtensionPlugin.ts');
    expect(mod.changeExtensionPlugin).toBeDefined();
  });

  it('should load copyToObsidianPluginsFolderPlugin so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/ScriptUtils/bundlers/esbuild/copyToObsidianPluginsFolderPlugin.ts');
    expect(mod.copyToObsidianPluginsFolderPlugin).toBeDefined();
  });

  it('should load customEsbuildOptionsPlugin so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/ScriptUtils/bundlers/esbuild/customEsbuildOptionsPlugin.ts');
    expect(mod.customEsbuildOptionsPlugin).toBeDefined();
  });

  it('should load fixEsmPlugin so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/ScriptUtils/bundlers/esbuild/fixEsmPlugin.ts');
    expect(mod.fixEsmPlugin).toBeDefined();
  });

  it('should load fixSourceMapsPlugin so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/ScriptUtils/bundlers/esbuild/fixSourceMapsPlugin.ts');
    expect(mod.fixSourceMapsPlugin).toBeDefined();
  });

  it('should load preprocessPlugin so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/ScriptUtils/bundlers/esbuild/preprocessPlugin.ts');
    expect(mod.preprocessPlugin).toBeDefined();
  });

  it('should load renameCssPlugin so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/ScriptUtils/bundlers/esbuild/renameCssPlugin.ts');
    expect(mod.renameCssPlugin).toBeDefined();
  });

  it('should load svelteWrapperPlugin so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/ScriptUtils/bundlers/esbuild/svelteWrapperPlugin.ts');
    expect(mod.svelteWrapperPlugin).toBeDefined();
  });

  it('should load markdownlint-cli2-config so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/ScriptUtils/linters/markdownlint/markdownlint-cli2-config.ts');
    expect(mod.obsidianDevUtilsConfig).toBeDefined();
  });

  it('should load DebugController so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/DebugController.ts');
    expect(mod).toBeDefined();
  });

  it('should load StateFieldSpec so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/codemirror/StateFieldSpec.ts');
    expect(mod).toBeDefined();
  });

  it('should load PluginSettingsWrapper so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/obsidian/Plugin/PluginSettingsWrapper.ts');
    expect(mod).toBeDefined();
  });

  it('should load PluginTypesBase so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/obsidian/Plugin/PluginTypesBase.ts');
    expect(mod).toBeDefined();
  });

  it('should load CustomTypeOptionsBase so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/obsidian/i18n/CustomTypeOptionsBase.ts');
    expect(mod).toBeDefined();
  }, HEAVY_IMPORT_TIMEOUT);

  it('should load DefaultTranslationsBase so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/obsidian/i18n/DefaultTranslationsBase.ts');
    expect(mod).toBeDefined();
  });

  it('should load ValueComponentWithChangeTracking so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/obsidian/Components/SettingComponents/ValueComponentWithChangeTracking.ts');
    expect(mod).toBeDefined();
  });

  it('should load CodeBlockMarkdownInformation so v8 processes its ignore comments', async () => {
    const mod = await import('../../src/obsidian/CodeBlockMarkdownInformation.ts');
    expect(mod).toBeDefined();
  });
});
