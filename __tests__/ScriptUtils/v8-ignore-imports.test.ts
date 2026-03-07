/**
 * This test file exists solely to import modules that are excluded from coverage
 * via `v8 ignore` comments. Without importing them, v8 never loads the files and
 * the ignore comments are not processed, causing them to appear as 0% covered.
 *
 * All imports are performed in beforeAll (with a generous timeout) so that slow
 * module resolution under parallel load never causes individual test timeouts.
 */
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

const IMPORT_TIMEOUT = 120_000;

const modules: Record<string, unknown> = {};

const modulePaths = [
  '../../src/ScriptUtils/NodeModules.ts',
  '../../src/ScriptUtils/linters/eslint/eslint.config.ts',
  '../../src/ScriptUtils/bundlers/esbuild/Dependency.ts',
  '../../src/ScriptUtils/bundlers/esbuild/ObsidianPluginBuilder.ts',
  '../../src/ScriptUtils/bundlers/esbuild/changeExtensionPlugin.ts',
  '../../src/ScriptUtils/bundlers/esbuild/copyToObsidianPluginsFolderPlugin.ts',
  '../../src/ScriptUtils/bundlers/esbuild/customEsbuildOptionsPlugin.ts',
  '../../src/ScriptUtils/bundlers/esbuild/fixEsmPlugin.ts',
  '../../src/ScriptUtils/bundlers/esbuild/fixSourceMapsPlugin.ts',
  '../../src/ScriptUtils/bundlers/esbuild/preprocessPlugin.ts',
  '../../src/ScriptUtils/bundlers/esbuild/renameCssPlugin.ts',
  '../../src/ScriptUtils/bundlers/esbuild/svelteWrapperPlugin.ts',
  '../../src/ScriptUtils/linters/markdownlint/markdownlint-cli2-config.ts',
  '../../src/DebugController.ts',
  '../../src/codemirror/StateFieldSpec.ts',
  '../../src/obsidian/Plugin/PluginSettingsWrapper.ts',
  '../../src/obsidian/Plugin/PluginTypesBase.ts',
  '../../src/obsidian/i18n/CustomTypeOptionsBase.ts',
  '../../src/obsidian/i18n/DefaultTranslationsBase.ts',
  '../../src/obsidian/Components/SettingComponents/ValueComponentWithChangeTracking.ts',
  '../../src/obsidian/CodeBlockMarkdownInformation.ts'
] as const;

describe('v8 ignore imports', () => {
  beforeAll(async () => {
    for (const path of modulePaths) {
      modules[path] = await import(path);
    }
  }, IMPORT_TIMEOUT);

  it('should load NodeModules so v8 processes its ignore comments', () => {
    const mod = modules['../../src/ScriptUtils/NodeModules.ts'] as Record<string, unknown>;
    expect(mod['process']).toBeDefined();
  });

  it('should load eslint.config so v8 processes its ignore comments', () => {
    const mod = modules['../../src/ScriptUtils/linters/eslint/eslint.config.ts'] as Record<string, unknown>;
    expect(mod['obsidianDevUtilsConfigs']).toBeDefined();
  });

  it('should load Dependency so v8 processes its ignore comments', () => {
    expect(modules['../../src/ScriptUtils/bundlers/esbuild/Dependency.ts']).toBeDefined();
  });

  it('should load ObsidianPluginBuilder so v8 processes its ignore comments', () => {
    expect(modules['../../src/ScriptUtils/bundlers/esbuild/ObsidianPluginBuilder.ts']).toBeDefined();
  });

  it('should load changeExtensionPlugin so v8 processes its ignore comments', () => {
    const mod = modules['../../src/ScriptUtils/bundlers/esbuild/changeExtensionPlugin.ts'] as Record<string, unknown>;
    expect(mod['changeExtensionPlugin']).toBeDefined();
  });

  it('should load copyToObsidianPluginsFolderPlugin so v8 processes its ignore comments', () => {
    const mod = modules['../../src/ScriptUtils/bundlers/esbuild/copyToObsidianPluginsFolderPlugin.ts'] as Record<string, unknown>;
    expect(mod['copyToObsidianPluginsFolderPlugin']).toBeDefined();
  });

  it('should load customEsbuildOptionsPlugin so v8 processes its ignore comments', () => {
    const mod = modules['../../src/ScriptUtils/bundlers/esbuild/customEsbuildOptionsPlugin.ts'] as Record<string, unknown>;
    expect(mod['customEsbuildOptionsPlugin']).toBeDefined();
  });

  it('should load fixEsmPlugin so v8 processes its ignore comments', () => {
    const mod = modules['../../src/ScriptUtils/bundlers/esbuild/fixEsmPlugin.ts'] as Record<string, unknown>;
    expect(mod['fixEsmPlugin']).toBeDefined();
  });

  it('should load fixSourceMapsPlugin so v8 processes its ignore comments', () => {
    const mod = modules['../../src/ScriptUtils/bundlers/esbuild/fixSourceMapsPlugin.ts'] as Record<string, unknown>;
    expect(mod['fixSourceMapsPlugin']).toBeDefined();
  });

  it('should load preprocessPlugin so v8 processes its ignore comments', () => {
    const mod = modules['../../src/ScriptUtils/bundlers/esbuild/preprocessPlugin.ts'] as Record<string, unknown>;
    expect(mod['preprocessPlugin']).toBeDefined();
  });

  it('should load renameCssPlugin so v8 processes its ignore comments', () => {
    const mod = modules['../../src/ScriptUtils/bundlers/esbuild/renameCssPlugin.ts'] as Record<string, unknown>;
    expect(mod['renameCssPlugin']).toBeDefined();
  });

  it('should load svelteWrapperPlugin so v8 processes its ignore comments', () => {
    const mod = modules['../../src/ScriptUtils/bundlers/esbuild/svelteWrapperPlugin.ts'] as Record<string, unknown>;
    expect(mod['svelteWrapperPlugin']).toBeDefined();
  });

  it('should load markdownlint-cli2-config so v8 processes its ignore comments', () => {
    const mod = modules['../../src/ScriptUtils/linters/markdownlint/markdownlint-cli2-config.ts'] as Record<string, unknown>;
    expect(mod['obsidianDevUtilsConfig']).toBeDefined();
  });

  it('should load DebugController so v8 processes its ignore comments', () => {
    expect(modules['../../src/DebugController.ts']).toBeDefined();
  });

  it('should load StateFieldSpec so v8 processes its ignore comments', () => {
    expect(modules['../../src/codemirror/StateFieldSpec.ts']).toBeDefined();
  });

  it('should load PluginSettingsWrapper so v8 processes its ignore comments', () => {
    expect(modules['../../src/obsidian/Plugin/PluginSettingsWrapper.ts']).toBeDefined();
  });

  it('should load PluginTypesBase so v8 processes its ignore comments', () => {
    expect(modules['../../src/obsidian/Plugin/PluginTypesBase.ts']).toBeDefined();
  });

  it('should load CustomTypeOptionsBase so v8 processes its ignore comments', () => {
    expect(modules['../../src/obsidian/i18n/CustomTypeOptionsBase.ts']).toBeDefined();
  });

  it('should load DefaultTranslationsBase so v8 processes its ignore comments', () => {
    expect(modules['../../src/obsidian/i18n/DefaultTranslationsBase.ts']).toBeDefined();
  });

  it('should load ValueComponentWithChangeTracking so v8 processes its ignore comments', () => {
    expect(modules['../../src/obsidian/Components/SettingComponents/ValueComponentWithChangeTracking.ts']).toBeDefined();
  });

  it('should load CodeBlockMarkdownInformation so v8 processes its ignore comments', () => {
    expect(modules['../../src/obsidian/CodeBlockMarkdownInformation.ts']).toBeDefined();
  });
});
