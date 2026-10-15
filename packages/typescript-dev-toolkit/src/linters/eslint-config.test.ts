import type {
  ESLint,
  Linter
} from 'eslint';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  createDefaultEslintConfigContext,
  defineEslintConfigs,
  EslintConfigContext,
  getEslintCoreConfigs,
  getTypeScriptEslintConfigs
} from './eslint-config.ts';
import {
  IN_HOUSE_ESLINT_PLUGIN_NAME,
  inHouseEslintPlugin
} from './eslint-rules/in-house-plugin.ts';
import { CLAUDE_WORKTREES_IGNORE_GLOB } from './lint-ignores.ts';

function findRuleEntry(configs: Linter.Config[], ruleName: string): Linter.RuleEntry | undefined {
  let ruleEntry: Linter.RuleEntry | undefined;
  for (const config of configs) {
    ruleEntry = config.rules?.[ruleName] ?? ruleEntry;
  }
  return ruleEntry;
}

function getRegisteredPlugins(configs: Linter.Config[]): Record<string, ESLint.Plugin>[] {
  const pluginRecords: Record<string, ESLint.Plugin>[] = [];
  for (const config of configs) {
    if (config.plugins) {
      pluginRecords.push(config.plugins);
    }
  }
  return pluginRecords;
}

describe('EslintConfigContext', () => {
  it('should list every file set in allFiles', () => {
    const context = new EslintConfigContext();
    context.testFiles.push('test');
    context.scriptFiles.push('script');
    context.rootConfigFiles.push('root');
    context.sourceFiles.push('source');
    expect(context.allFiles()).toEqual(['test', 'script', 'root', 'source']);
  });
});

describe('createDefaultEslintConfigContext', () => {
  it('should describe a conventionally laid out project', () => {
    const context = createDefaultEslintConfigContext();
    expect(context.sourceFolders).toEqual(['src']);
    expect(context.rootConfigFiles).toEqual(['commitlint.config.ts', 'eslint.config.mts', 'vitest.config.ts']);
    expect(context.scriptFiles).toEqual(['scripts/**/*.ts']);
    expect(context.sourceFiles).toEqual(['src/**/*.ts', 'src/**/*.tsx']);
    expect(context.testFiles).toEqual(['__tests__/**/*.ts', 'src/test-helpers/**/*.ts', 'src/**/*.test.ts', 'scripts/**/*.test.ts']);
  });
});

describe('defineEslintConfigs', () => {
  it('should ignore Claude Code\'s worktree folder globally', () => {
    const configs = defineEslintConfigs();
    const isGlobalIgnore = configs.some((config) => config.files === undefined && (config.ignores?.includes(CLAUDE_WORKTREES_IGNORE_GLOB) ?? false));
    expect(isGlobalIgnore).toBe(true);
  });

  it('should register no Obsidian plugin and target no Obsidian file', () => {
    const configs = defineEslintConfigs();
    const pluginNames = getRegisteredPlugins(configs).flatMap((plugins) => Object.keys(plugins));
    expect(pluginNames).not.toContain('obsidianmd');
    const serialized = JSON.stringify(configs.map((config) => ({ files: config.files, ignores: config.ignores, rules: config.rules })));
    expect(serialized).not.toContain('obsidianmd');
    expect(serialized).not.toContain('manifest.json');
    expect(serialized).not.toContain('desktop-');
  });

  it('should register the generic in-house plugin under the in-house namespace', () => {
    const configs = defineEslintConfigs();
    const inHousePlugins = getRegisteredPlugins(configs).flatMap((plugins) => plugins[IN_HOUSE_ESLINT_PLUGIN_NAME] ?? []);
    expect(inHousePlugins.length).toBeGreaterThan(0);
    expect(inHousePlugins.every((plugin) => plugin === inHouseEslintPlugin)).toBe(true);
    expect(findRuleEntry(configs, 'obsidian-dev-utils/no-unused-params-members')).toBe('error');
  });

  it('should let the context be edited and append the custom configurations last', () => {
    const editContext = vi.fn((context: EslintConfigContext) => {
      context.sourceFiles.push('lib/**/*.ts');
    });
    const customConfig: Linter.Config = { rules: { 'no-console': 'off' } };
    const customConfigs = vi.fn((context: EslintConfigContext): Linter.Config[] => {
      expect(context.sourceFiles).toContain('lib/**/*.ts');
      return [customConfig];
    });

    const configs = defineEslintConfigs({ customConfigs, editContext });

    expect(editContext).toHaveBeenCalledTimes(1);
    expect(customConfigs).toHaveBeenCalledTimes(1);
    expect(configs.at(-1)?.rules).toEqual(customConfig.rules);
  });

  it('should leave the Node version of the compatibility rules to the project\'s engines field', () => {
    const configs = defineEslintConfigs();
    expect(findRuleEntry(configs, 'n/no-unsupported-features/es-builtins')).toEqual(['error', {}]);
    expect(findRuleEntry(configs, 'n/no-unsupported-features/node-builtins')).toEqual(['error', { ignores: ['Blob', 'File'] }]);
  });

  it('should pin the Node version of the compatibility rules when given one', () => {
    const configs = defineEslintConfigs({ minimumNodeVersion: '>=16.16.0' });
    expect(findRuleEntry(configs, 'n/no-unsupported-features/es-builtins')).toEqual(['error', { version: '>=16.16.0' }]);
    expect(findRuleEntry(configs, 'n/no-unsupported-features/node-builtins')).toEqual(['error', { ignores: ['Blob', 'File'], version: '>=16.16.0' }]);
  });
});

describe('getTypeScriptEslintConfigs', () => {
  it('should register the plugin it is given and pin the Node version it is given', () => {
    const inHousePlugin: ESLint.Plugin = { rules: { ...inHouseEslintPlugin.rules } };
    const configs = getTypeScriptEslintConfigs({
      context: createDefaultEslintConfigContext(),
      inHousePlugin,
      minimumNodeVersion: '>=16.16.0'
    });

    const inHousePlugins = getRegisteredPlugins(configs).flatMap((plugins) => plugins[IN_HOUSE_ESLINT_PLUGIN_NAME] ?? []);
    expect(inHousePlugins).toEqual([inHousePlugin]);
    expect(findRuleEntry(configs, 'n/no-unsupported-features/es-builtins')).toEqual(['error', { version: '>=16.16.0' }]);
    expect(findRuleEntry(configs, 'n/no-unsupported-features/node-builtins')).toEqual(['error', { ignores: ['Blob', 'File'], version: '>=16.16.0' }]);
  });
});

describe('getEslintCoreConfigs', () => {
  it('should set ESLint core rules only', () => {
    const ruleNames = getEslintCoreConfigs(createDefaultEslintConfigContext()).flatMap((config) => Object.keys(config.rules ?? {}));
    expect(ruleNames).toContain('no-console');
    expect(ruleNames.every((ruleName) => !ruleName.includes('/'))).toBe(true);
  });
});
