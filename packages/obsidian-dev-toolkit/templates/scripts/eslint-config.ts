import type { Linter } from 'eslint';

import { defineEslintConfigs } from '@mnaoumov/obsidian-dev-toolkit/linters/eslint-config';

export const configs: Linter.Config[] = defineEslintConfigs({
  // Pass `customConfigs()` to add plugin-specific rules, e.g. brand names for `obsidianmd/ui/sentence-case`:
  // customConfigs() {
  //   return defineConfig({ rules: { 'obsidianmd/ui/sentence-case': ['error', { brands: ['My Plugin'] }] } });
  // }
});
